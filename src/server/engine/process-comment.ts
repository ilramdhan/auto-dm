import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { deliveries, type InstagramAccount } from "@/server/db/schema";
import { getAccessToken, getActiveAccount } from "@/server/instagram/account";
import { COMMENT_MAX_CHARS, DM_MAX_CHARS } from "@/server/instagram/constants";
import { GraphApiError, safeErrorMessage } from "@/server/instagram/graph";
import { logger, type Logger } from "@/server/log";
import { replyToComment, sendPrivateReply } from "@/server/instagram/messaging";
import type { CommentEvent } from "@/server/instagram/webhook";
import { getSetting } from "@/server/settings";
import { resolveRule } from "./resolve";
import { pickRandom, renderTemplate, truncateText } from "./template";

const rootLog = logger("engine");

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
  /** Graph API error code of the first failure, if any. */
  errorCode: string | null;
  durationMs: number;
}

type ActionStatus = "not_attempted" | "sent" | "failed";

function errorCodeOf(err: unknown): string {
  if (err instanceof GraphApiError) return err.code !== undefined ? String(err.code) : `HTTP_${err.status}`;
  return "INTERNAL";
}

function result(
  event: CommentEvent,
  partial: Partial<ProcessResult> & { status: ProcessStatus },
): ProcessResult {
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
    errorCode: null,
    durationMs: 0,
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
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`once:${params.ruleId}:${params.commenterId}`}, 0))`,
      );
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
      .set({
        ruleId: params.ruleId,
        campaignId: params.campaignId,
        matchedKeyword: params.keyword,
        status: "processing",
      })
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
  opts: { source: DeliverySource; now?: Date; log?: Logger },
): Promise<ProcessResult> {
  const log = opts.log ?? rootLog;
  const started = Date.now();
  const elapsed = () => Date.now() - started;
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
  if (!inserted) {
    const res = result(event, { status: "duplicate", durationMs: elapsed() });
    log.info("comment.processed", {
      commentId: event.commentId,
      status: res.status,
      source: opts.source,
      durationMs: res.durationMs,
    });
    return res;
  }
  const deliveryId = inserted.id;

  const finish = (res: ProcessResult): ProcessResult => {
    log.info("comment.processed", {
      commentId: res.commentId,
      deliveryId,
      source: opts.source,
      status: res.status,
      skipReason: res.skipReason,
      ruleId: res.ruleId,
      errorCode: res.errorCode,
      durationMs: res.durationMs,
    });
    return res;
  };

  const skip = async (
    reason: SkipReason,
    extra: { campaignId?: string | null; ruleId?: string | null; matchedKeyword?: string | null } = {},
  ): Promise<ProcessResult> => {
    const durationMs = elapsed();
    await db
      .update(deliveries)
      .set({ status: "skipped", skipReason: reason, processedAt: new Date(), durationMs, ...extra })
      .where(eq(deliveries.id, deliveryId));
    return finish(result(event, { status: "skipped", deliveryId, skipReason: reason, durationMs, ...extra }));
  };

  let token: string | undefined;
  let matchInfo: { campaignId: string; ruleId: string; matchedKeyword: string } | undefined;
  try {
    const account = await getActiveAccount();
    if (!account || !account.accessTokenEnc) return await skip("no_account");
    if (event.igUserId && event.igUserId !== account.igUserId) return await skip("account_mismatch");
    // Loop protection: our own comments, including the public replies we post.
    if (isOwnComment(event, account)) return await skip("own_comment");
    if (!event.text.trim()) return await skip("empty_comment");

    const match = await resolveRule({
      accountId: account.id,
      mediaId: event.mediaId,
      text: event.text,
      now: opts.now,
    });
    if (!match) return await skip("no_match");
    matchInfo = { campaignId: match.campaign.id, ruleId: match.rule.id, matchedKeyword: match.keyword };

    if ((await getSetting("processing.enabled")) === false)
      return await skip("processing_disabled", matchInfo);

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
    let errorCode: string | null = null;
    let publicReplyStatus: ActionStatus = "not_attempted";
    let dmStatus: ActionStatus = "not_attempted";
    let publicReplyId: string | null = null;
    let dmMessageId: string | null = null;

    const variant = pickRandom(match.rule.publicReplies.filter((r) => r.trim()));
    const publicText = variant ? truncateText(renderTemplate(variant, vars).trim(), COMMENT_MAX_CHARS) : "";
    if (publicText) {
      try {
        publicReplyId = (await replyToComment(token, event.commentId, publicText)).id;
        publicReplyStatus = "sent";
      } catch (err) {
        publicReplyStatus = "failed";
        errorCode ??= errorCodeOf(err);
        errors.push(`public reply: ${safeErrorMessage(err, [token], 240)}`);
        log.warn("action.public_reply_failed", {
          commentId: event.commentId,
          err: safeErrorMessage(err, [token]),
        });
      }
    }

    const dmText = truncateText(renderTemplate(match.rule.dmMessage, vars).trim(), DM_MAX_CHARS);
    if (dmText) {
      const button =
        match.rule.dmButtonUrl && match.rule.dmButtonTitle
          ? { title: match.rule.dmButtonTitle, url: match.rule.dmButtonUrl }
          : null;
      try {
        const dm = await sendPrivateReply({
          accessToken: token,
          igUserId: account.igUserId,
          commentId: event.commentId,
          text: dmText,
          button,
        });
        dmMessageId = dm.messageId;
        dmStatus = "sent";
        if (dm.templateFallback) {
          log.warn("action.dm_template_fallback", {
            commentId: event.commentId,
            graphCode: dm.templateFallback.code,
          });
        }
      } catch (err) {
        dmStatus = "failed";
        errorCode ??= errorCodeOf(err);
        errors.push(`private reply: ${safeErrorMessage(err, [token], 240)}`);
        log.warn("action.dm_failed", { commentId: event.commentId, err: safeErrorMessage(err, [token]) });
      }
    }

    const outcomes = [publicReplyStatus, dmStatus].filter((s) => s !== "not_attempted");
    if (outcomes.length === 0) return await skip("no_actions", matchInfo);

    const status = outcomes.every((s) => s === "sent")
      ? "sent"
      : outcomes.every((s) => s === "failed")
        ? "failed"
        : "partial";
    const error = errors.length ? errors.join("; ") : null;
    const durationMs = elapsed();
    await db
      .update(deliveries)
      .set({
        status,
        publicReplyStatus,
        publicReplyId,
        dmStatus,
        dmMessageId,
        error,
        errorCode,
        durationMs,
        attempts: sql`${deliveries.attempts} + 1`,
        processedAt: new Date(),
      })
      .where(eq(deliveries.id, deliveryId));
    return finish(
      result(event, {
        status,
        deliveryId,
        ...matchInfo,
        error,
        errorCode,
        publicReplyId,
        dmMessageId,
        durationMs,
      }),
    );
  } catch (err) {
    const error = safeErrorMessage(err, [token]);
    const errorCode = errorCodeOf(err);
    const durationMs = elapsed();
    log.error("comment.processing_error", { commentId: event.commentId, deliveryId, err: error });
    await db
      .update(deliveries)
      .set({ status: "failed", error, errorCode, durationMs, processedAt: new Date() })
      .where(eq(deliveries.id, deliveryId))
      .catch(() => undefined);
    return finish(
      result(event, { status: "failed", deliveryId, ...matchInfo, error, errorCode, durationMs }),
    );
  }
}

/** Processes events sequentially (keeps Graph API calls and DB load predictable). */
export async function processCommentEvents(
  events: readonly CommentEvent[],
  opts: { source: DeliverySource; log?: Logger },
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  for (const event of events) results.push(await processCommentEvent(event, opts));
  return results;
}
