import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { deliveries, type InstagramAccount } from "@/server/db/schema";
import { getAccessToken, getActiveAccount } from "@/server/instagram/account";
import { COMMENT_MAX_CHARS, DM_MAX_CHARS } from "@/server/instagram/constants";
import { safeErrorMessage } from "@/server/instagram/graph";
import { replyToComment, sendPrivateReply } from "@/server/instagram/messaging";
import type { CommentEvent } from "@/server/instagram/webhook";
import { getSetting } from "@/server/settings";
import { resolveRule } from "./resolve";
import { pickRandom, renderTemplate, truncateText } from "./template";

export type DeliverySource = "webhook" | "n8n" | "manual";

/** Why a comment was skipped (stored in `deliveries.skip_reason`). */
export type SkipReason =
  | "no_account"
  | "account_mismatch"
  | "own_comment"
  | "empty_comment"
  | "no_match"
  | "processing_disabled"
  | "already_delivered"
  | "no_actions";

export type ProcessStatus = "sent" | "partial" | "failed" | "skipped" | "duplicate";

export interface ProcessResult {
  commentId: string;
  status: ProcessStatus;
  deliveryId: string | null;
  campaignId: string | null;
  ruleId: string | null;
  matchedKeyword: string | null;
  skipReason: SkipReason | null;
  error: string | null;
  publicReplyId: string | null;
  dmMessageId: string | null;
}

function result(event: CommentEvent, partial: Partial<ProcessResult> & { status: ProcessStatus }): ProcessResult {
  return {
    commentId: event.commentId,
    deliveryId: null,
    campaignId: null,
    ruleId: null,
    matchedKeyword: null,
    skipReason: null,
    error: null,
    publicReplyId: null,
    dmMessageId: null,
    ...partial,
  };
}

function isOwnComment(event: CommentEvent, account: InstagramAccount): boolean {
  if (event.fromId === account.igUserId) return true;
  if (event.igUserId && event.fromId === event.igUserId) return true;
  return !!event.fromUsername && event.fromUsername.toLowerCase() === account.username.toLowerCase();
}

/**
 * Atomically checks once-per-user and claims the rule for this delivery. Serialized per
 * (rule, commenter) with a transaction-scoped advisory lock so two concurrent comments from the same
 * user can't both be sent. Returns false when the user already got (or is getting) this rule.
 */
async function claimRule(params: {
  deliveryId: string;
  ruleId: string;
  campaignId: string;
  keyword: string;
  commenterId: string;
  oncePerUser: boolean;
}): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (params.oncePerUser) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`once:${params.ruleId}:${params.commenterId}`}, 0))`);
      const [prior] = await tx
        .select({ id: deliveries.id })
        .from(deliveries)
        .where(
          and(
            eq(deliveries.ruleId, params.ruleId),
            eq(deliveries.commenterId, params.commenterId),
            inArray(deliveries.status, ["sent", "partial", "processing"]),
            ne(deliveries.id, params.deliveryId),
          ),
        )
        .limit(1);
      if (prior) return false;
    }
    await tx
      .update(deliveries)
      .set({ ruleId: params.ruleId, campaignId: params.campaignId, matchedKeyword: params.keyword, status: "processing" })
      .where(eq(deliveries.id, params.deliveryId));
    return true;
  });
}

/**
 * Processes one comment event end-to-end and records the outcome in `deliveries`.
 *
 * Idempotent: the `deliveries` row is inserted first with `ON CONFLICT (comment_id) DO NOTHING`;
 * a second call for the same comment returns `status: "duplicate"` without side effects.
 * Never throws for Instagram/API failures (they are recorded as `failed`/`partial`).
 */
export async function processCommentEvent(
  event: CommentEvent,
  opts: { source: DeliverySource; now?: Date },
): Promise<ProcessResult> {
  const [inserted] = await db
    .insert(deliveries)
    .values({
      commentId: event.commentId,
      mediaId: event.mediaId,
      igUserId: event.igUserId,
      commenterId: event.fromId,
      commenterUsername: event.fromUsername,
      commentText: event.text.slice(0, COMMENT_MAX_CHARS),
      status: "received",
      source: opts.source,
    })
    .onConflictDoNothing({ target: deliveries.commentId })
    .returning({ id: deliveries.id });
  if (!inserted) return result(event, { status: "duplicate" });
  const deliveryId = inserted.id;

  const skip = async (
    reason: SkipReason,
    extra: { campaignId?: string | null; ruleId?: string | null; matchedKeyword?: string | null } = {},
  ): Promise<ProcessResult> => {
    await db
      .update(deliveries)
      .set({ status: "skipped", skipReason: reason, processedAt: new Date(), ...extra })
      .where(eq(deliveries.id, deliveryId));
    return result(event, { status: "skipped", deliveryId, skipReason: reason, ...extra });
  };

  let token: string | undefined;
  try {
    const account = await getActiveAccount();
    if (!account || !account.accessTokenEnc) return await skip("no_account");
    if (event.igUserId && event.igUserId !== account.igUserId) return await skip("account_mismatch");
    // Loop protection: our own comments, including the public replies we post.
    if (isOwnComment(event, account)) return await skip("own_comment");
    if (!event.text.trim()) return await skip("empty_comment");

    const match = await resolveRule({ accountId: account.id, mediaId: event.mediaId, text: event.text, now: opts.now });
    if (!match) return await skip("no_match");
    const matchInfo = { campaignId: match.campaign.id, ruleId: match.rule.id, matchedKeyword: match.keyword };

    if ((await getSetting("processing.enabled")) === false) return await skip("processing_disabled", matchInfo);

    const claimed = await claimRule({
      deliveryId,
      ruleId: match.rule.id,
      campaignId: match.campaign.id,
      keyword: match.keyword,
      commenterId: event.fromId,
      oncePerUser: match.rule.oncePerUser,
    });
    if (!claimed) return await skip("already_delivered", matchInfo);

    token = getAccessToken(account);
    const vars = { username: event.fromUsername, keyword: match.keyword };
    const errors: string[] = [];
    let attempted = 0;
    let succeeded = 0;
    let publicReplyId: string | null = null;
    let dmMessageId: string | null = null;

    const variant = pickRandom(match.rule.publicReplies.filter((r) => r.trim()));
    const publicText = variant ? truncateText(renderTemplate(variant, vars).trim(), COMMENT_MAX_CHARS) : "";
    if (publicText) {
      attempted++;
      try {
        publicReplyId = (await replyToComment(token, event.commentId, publicText)).id;
        succeeded++;
      } catch (err) {
        errors.push(`public reply: ${safeErrorMessage(err, [token], 240)}`);
      }
    }

    const dmText = truncateText(renderTemplate(match.rule.dmMessage, vars).trim(), DM_MAX_CHARS);
    if (dmText) {
      attempted++;
      const button =
        match.rule.dmButtonUrl && match.rule.dmButtonTitle
          ? { title: match.rule.dmButtonTitle, url: match.rule.dmButtonUrl }
          : null;
      try {
        dmMessageId = (
          await sendPrivateReply({ accessToken: token, igUserId: account.igUserId, commentId: event.commentId, text: dmText, button })
        ).messageId;
        succeeded++;
      } catch (err) {
        errors.push(`private reply: ${safeErrorMessage(err, [token], 240)}`);
      }
    }

    if (attempted === 0) return await skip("no_actions", matchInfo);

    const status = succeeded === attempted ? "sent" : succeeded === 0 ? "failed" : "partial";
    const error = errors.length ? errors.join("; ") : null;
    await db
      .update(deliveries)
      .set({ status, publicReplyId, dmMessageId, error, attempts: sql`${deliveries.attempts} + 1`, processedAt: new Date() })
      .where(eq(deliveries.id, deliveryId));
    return result(event, { status, deliveryId, ...matchInfo, error, publicReplyId, dmMessageId });
  } catch (err) {
    const error = safeErrorMessage(err, [token]);
    await db
      .update(deliveries)
      .set({ status: "failed", error, processedAt: new Date() })
      .where(eq(deliveries.id, deliveryId))
      .catch(() => undefined);
    return result(event, { status: "failed", deliveryId, error });
  }
}

/** Processes events sequentially (keeps Graph API calls and DB load predictable). */
export async function processCommentEvents(
  events: readonly CommentEvent[],
  opts: { source: DeliverySource },
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  for (const event of events) results.push(await processCommentEvent(event, opts));
  return results;
}
