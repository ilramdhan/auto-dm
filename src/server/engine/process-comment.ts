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
import type { SkipReason } from "@/lib/validation/skipped";
import { getSetting } from "@/server/settings";
import { templateKeyword } from "./match";
import { resolveOtherPostRule, resolveRule, type ResolvedMatch } from "./resolve";
import { pickRandom, renderTemplate, truncateText } from "./template";

const rootLog = logger("engine");

export type DeliverySource = "webhook" | "n8n" | "manual";

/** Why a comment was skipped (stored in `deliveries.skip_reason`). */
export type { SkipReason };

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
  commentId: string,
  partial: Partial<ProcessResult> & { status: ProcessStatus },
): ProcessResult {
  return {
    commentId,
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

export interface SendForDeliveryInput {
  /** An existing `deliveries` row (already inserted; status `received` or claimed `processing`). */
  deliveryId: string;
  commentId: string;
  commenterId: string | null;
  commenterUsername: string | null;
  account: InstagramAccount;
  match: ResolvedMatch;
  source: DeliverySource;
  /** Manual send override: don't check "once per user" for this send. */
  ignoreOncePerUser?: boolean;
  log?: Logger;
  /** `Date.now()` when processing started, for `duration_ms`. Defaults to now. */
  startedAt?: number;
}

async function markSkipped(
  deliveryId: string,
  reason: SkipReason,
  durationMs: number,
  extra: { campaignId?: string | null; ruleId?: string | null; matchedKeyword?: string | null } = {},
): Promise<void> {
  await db
    .update(deliveries)
    .set({ status: "skipped", skipReason: reason, processedAt: new Date(), durationMs, ...extra })
    .where(eq(deliveries.id, deliveryId));
}

function logProcessed(log: Logger, res: ProcessResult, source: DeliverySource): ProcessResult {
  log.info("comment.processed", {
    commentId: res.commentId,
    deliveryId: res.deliveryId,
    source,
    status: res.status,
    skipReason: res.skipReason,
    ruleId: res.ruleId,
    errorCode: res.errorCode,
    durationMs: res.durationMs,
  });
  return res;
}

/**
 * The send path shared by the engine and manual send: claims the rule (once-per-user check),
 * posts the public reply, sends the Private Reply and records the outcome on the existing
 * `deliveries` row. Never throws for Instagram/API failures (recorded as `failed`/`partial`); when
 * once-per-user blocks the send the row goes (back) to `skipped` with `already_delivered`.
 *
 * Callers are responsible for every check before this point (account, own comment, kill switch,
 * 7-day window for manual sends) and for making sure only one caller runs per delivery row.
 */
export async function sendForDelivery(input: SendForDeliveryInput): Promise<ProcessResult> {
  const log = input.log ?? rootLog;
  const started = input.startedAt ?? Date.now();
  const elapsed = () => Date.now() - started;
  const { deliveryId, commentId, account, match } = input;
  const matchInfo = { campaignId: match.campaign.id, ruleId: match.rule.id, matchedKeyword: match.keyword };
  const finish = (partial: Partial<ProcessResult> & { status: ProcessStatus }) =>
    logProcessed(log, result(commentId, { deliveryId, ...matchInfo, ...partial }), input.source);
  const skip = async (reason: SkipReason): Promise<ProcessResult> => {
    const durationMs = elapsed();
    await markSkipped(deliveryId, reason, durationMs, matchInfo);
    return finish({ status: "skipped", skipReason: reason, durationMs });
  };

  let token: string | undefined;
  try {
    const oncePerUser = match.rule.oncePerUser && !input.ignoreOncePerUser;
    const claimed = await claimRule({
      deliveryId,
      ruleId: match.rule.id,
      campaignId: match.campaign.id,
      keyword: match.keyword,
      commenterId: input.commenterId ?? "",
      oncePerUser: oncePerUser && input.commenterId !== null,
    });
    if (!claimed) return await skip("already_delivered");

    token = getAccessToken(account);
    const vars = { username: input.commenterUsername, keyword: templateKeyword(match.keyword) };
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
        publicReplyId = (await replyToComment(token, commentId, publicText)).id;
        publicReplyStatus = "sent";
      } catch (err) {
        publicReplyStatus = "failed";
        errorCode ??= errorCodeOf(err);
        errors.push(`public reply: ${safeErrorMessage(err, [token], 240)}`);
        log.warn("action.public_reply_failed", { commentId, err: safeErrorMessage(err, [token]) });
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
          commentId,
          text: dmText,
          button,
        });
        dmMessageId = dm.messageId;
        dmStatus = "sent";
        if (dm.templateFallback) {
          log.warn("action.dm_template_fallback", { commentId, graphCode: dm.templateFallback.code });
        }
      } catch (err) {
        dmStatus = "failed";
        errorCode ??= errorCodeOf(err);
        errors.push(`private reply: ${safeErrorMessage(err, [token], 240)}`);
        log.warn("action.dm_failed", { commentId, err: safeErrorMessage(err, [token]) });
      }
    }

    const outcomes = [publicReplyStatus, dmStatus].filter((s) => s !== "not_attempted");
    if (outcomes.length === 0) return await skip("no_actions");

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
        skipReason: null,
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
    return finish({ status, error, errorCode, publicReplyId, dmMessageId, durationMs });
  } catch (err) {
    return recordFailure({
      deliveryId,
      commentId,
      err,
      token,
      durationMs: elapsed(),
      log,
      source: input.source,
      matchInfo,
    });
  }
}

async function recordFailure(p: {
  deliveryId: string;
  commentId: string;
  err: unknown;
  token: string | undefined;
  durationMs: number;
  log: Logger;
  source: DeliverySource;
  matchInfo?: { campaignId: string; ruleId: string; matchedKeyword: string };
}): Promise<ProcessResult> {
  const error = safeErrorMessage(p.err, [p.token]);
  const errorCode = errorCodeOf(p.err);
  p.log.error("comment.processing_error", { commentId: p.commentId, deliveryId: p.deliveryId, err: error });
  await db
    .update(deliveries)
    .set({
      status: "failed",
      skipReason: null,
      error,
      errorCode,
      durationMs: p.durationMs,
      processedAt: new Date(),
    })
    .where(eq(deliveries.id, p.deliveryId))
    .catch(() => undefined);
  return logProcessed(
    p.log,
    result(p.commentId, {
      status: "failed",
      deliveryId: p.deliveryId,
      ...p.matchInfo,
      error,
      errorCode,
      durationMs: p.durationMs,
    }),
    p.source,
  );
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
    const res = result(event.commentId, { status: "duplicate", durationMs: elapsed() });
    log.info("comment.processed", {
      commentId: event.commentId,
      status: res.status,
      source: opts.source,
      durationMs: res.durationMs,
    });
    return res;
  }
  const deliveryId = inserted.id;

  const skip = async (
    reason: SkipReason,
    extra: { campaignId?: string | null; ruleId?: string | null; matchedKeyword?: string | null } = {},
  ): Promise<ProcessResult> => {
    const durationMs = elapsed();
    await markSkipped(deliveryId, reason, durationMs, extra);
    return logProcessed(
      log,
      result(event.commentId, { status: "skipped", deliveryId, skipReason: reason, durationMs, ...extra }),
      opts.source,
    );
  };

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
      isReply: event.parentId != null,
      now: opts.now,
    });
    if (!match) {
      // One extra query, only on this path: would the text match a campaign for another post
      // (e.g. the organic reel while this comment is on its ad version)?
      const other = await resolveOtherPostRule({
        accountId: account.id,
        mediaId: event.mediaId,
        text: event.text,
        isReply: event.parentId != null,
        now: opts.now,
      });
      return other
        ? await skip("no_campaign_for_post", {
            campaignId: other.campaign.id,
            ruleId: other.rule.id,
            matchedKeyword: other.keyword,
          })
        : await skip("no_match");
    }
    matchInfo = { campaignId: match.campaign.id, ruleId: match.rule.id, matchedKeyword: match.keyword };

    if ((await getSetting("processing.enabled")) === false)
      return await skip("processing_disabled", matchInfo);

    return await sendForDelivery({
      deliveryId,
      commentId: event.commentId,
      commenterId: event.fromId,
      commenterUsername: event.fromUsername,
      account,
      match,
      source: opts.source,
      log,
      startedAt: started,
    });
  } catch (err) {
    return recordFailure({
      deliveryId,
      commentId: event.commentId,
      err,
      token: undefined,
      durationMs: elapsed(),
      log,
      source: opts.source,
      matchInfo,
    });
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
