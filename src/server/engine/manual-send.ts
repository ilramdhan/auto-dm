import "server-only";
import { db } from "@/server/db/client";
import { campaigns } from "@/server/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { AppError } from "@/server/errors";
import { getAccessToken, getActiveAccount } from "@/server/instagram/account";
import { fetchRecentComments } from "@/server/instagram/comments";
import { GraphApiError, safeErrorMessage } from "@/server/instagram/graph";
import { logger } from "@/server/log";
import {
  claimSkippedDelivery,
  getDelivery,
  insertMissedComments,
  restoreSkippedDelivery,
  type MissedCommentInput,
} from "@/server/repos/deliveries";
import { getSetting } from "@/server/settings";
import { manualSendBlocker, manualMatch, manualRuleCandidates, privateReplyWindowStart } from "./manual";
import { sendForDelivery, type ProcessResult } from "./process-comment";
import { loadActiveCampaigns } from "./resolve";

const log = logger("manual");

/**
 * Sends one rule's public reply + DM to a skipped comment, chosen by the operator.
 *
 * Checks (in order): the row exists and is sendable (not own comment / other account, < 7 days),
 * the kill switch is on, an account is connected, the rule is active and offered for the post (see `manualRuleCandidates`).
 * Then claims the row atomically (`skipped` → `processing`); a second request gets "already
 * handled". Once-per-user is honoured unless `ignoreOncePerUser`; when it blocks, the row goes back
 * to `skipped` / `already_delivered`. The outcome is recorded on the same row (source `manual`).
 * Throws `AppError` for refusals (user-safe messages).
 */
export async function manualSend(input: {
  deliveryId: string;
  ruleId: string;
  ignoreOncePerUser?: boolean;
  now?: Date;
}): Promise<ProcessResult> {
  const now = input.now ?? new Date();
  const started = Date.now();
  const delivery = await getDelivery(input.deliveryId);
  if (!delivery) throw new AppError("NOT_FOUND", "This comment no longer exists.");
  const blocker = manualSendBlocker(delivery, now);
  if (blocker) throw new AppError("CONFLICT", blocker);
  if (!delivery.commenterId) throw new AppError("CONFLICT", "This comment has no commenter id to reply to.");

  if ((await getSetting("processing.enabled")) === false)
    throw new AppError("CONFLICT", "Automation is paused. Turn it back on in Settings → Processing first.");
  const account = await getActiveAccount();
  if (!account || !account.accessTokenEnc)
    throw new AppError("NOT_CONFIGURED", "Connect an Instagram account in Settings → Instagram first.");
  if (delivery.igUserId && delivery.igUserId !== account.igUserId)
    throw new AppError("CONFLICT", "This comment belongs to a different Instagram account.");
  if (delivery.commenterId === account.igUserId)
    throw new AppError("CONFLICT", "Comments from the connected account are never answered.");

  const target = manualRuleCandidates(
    await loadActiveCampaigns({ accountId: account.id, now }),
    delivery,
  ).find((x) => x.rule.id === input.ruleId);
  if (!target)
    throw new AppError("VALIDATION", "That rule is no longer active for this post. Pick another one.");

  if (!(await claimSkippedDelivery(delivery.id)))
    throw new AppError("CONFLICT", "This comment was already handled (sent or being sent).");

  try {
    const res = await sendForDelivery({
      deliveryId: delivery.id,
      commentId: delivery.commentId,
      commenterId: delivery.commenterId,
      commenterUsername: delivery.commenterUsername,
      account,
      match: manualMatch(delivery.commentText, target.campaign, target.rule),
      source: "manual",
      ignoreOncePerUser: input.ignoreOncePerUser,
      log,
      startedAt: started,
    });
    log.info("manual.sent", {
      deliveryId: delivery.id,
      ruleId: target.rule.id,
      status: res.status,
      ignoreOncePerUser: !!input.ignoreOncePerUser,
    });
    return res;
  } catch (err) {
    // sendForDelivery records its own failures; this only covers an unexpected throw before it did.
    await restoreSkippedDelivery(delivery.id, delivery.skipReason).catch(() => undefined);
    throw err;
  }
}

export interface SyncMissedResult {
  posts: number;
  /** Comments read from Instagram within the last 7 days. */
  checked: number;
  /** New `not_delivered` rows. */
  added: number;
  /** Posts that had more than the page cap allows (older comments weren't read). */
  truncated: number;
  /** Posts that couldn't be read (Graph API error). */
  failed: number;
}

/**
 * "Check post for missed comments": reads the last 7 days of comments (and inline replies) of each
 * active post campaign's media (or of one campaign) and records the ones with no `deliveries` row
 * as `skipped` / `not_delivered`. Nothing is sent. Our own account's comments are ignored.
 */
export async function syncMissedComments(input: {
  campaignId?: string;
  now?: Date;
}): Promise<SyncMissedResult> {
  const now = input.now ?? new Date();
  const account = await getActiveAccount();
  if (!account || !account.accessTokenEnc)
    throw new AppError("NOT_CONFIGURED", "Connect an Instagram account in Settings → Instagram first.");

  const rows = await db
    .select({ mediaId: campaigns.mediaId })
    .from(campaigns)
    .where(
      input.campaignId
        ? and(eq(campaigns.id, input.campaignId), isNotNull(campaigns.mediaId))
        : and(eq(campaigns.isActive, true), isNotNull(campaigns.mediaId)),
    );
  const mediaIds = [...new Set(rows.map((r) => r.mediaId).filter((m): m is string => !!m))];
  if (input.campaignId && mediaIds.length === 0)
    throw new AppError(
      "VALIDATION",
      "That campaign isn't for a specific post, so there is nothing to check.",
    );

  const token = getAccessToken(account);
  const since = privateReplyWindowStart(now);
  const result: SyncMissedResult = { posts: mediaIds.length, checked: 0, added: 0, truncated: 0, failed: 0 };
  for (const mediaId of mediaIds) {
    try {
      const { comments, truncated } = await fetchRecentComments({ accessToken: token, mediaId, since });
      result.checked += comments.length;
      if (truncated) result.truncated++;
      const missed: MissedCommentInput[] = comments
        .filter(
          (c) =>
            c.fromId !== account.igUserId &&
            (c.fromUsername ?? "").toLowerCase() !== account.username.toLowerCase(),
        )
        .map((c) => ({
          commentId: c.commentId,
          mediaId: c.mediaId,
          igUserId: account.igUserId,
          commenterId: c.fromId,
          commenterUsername: c.fromUsername,
          text: c.text,
          createdAt: c.createdAt,
        }));
      result.added += await insertMissedComments(missed);
    } catch (err) {
      if (!(err instanceof GraphApiError)) throw err;
      result.failed++;
      log.warn("sync.media_failed", { mediaId, err: safeErrorMessage(err, [token]) });
      if (err.isAuthError)
        throw new AppError("UPSTREAM", "Instagram rejected the access token. Reconnect Instagram.");
    }
  }
  log.info("sync.done", { ...result });
  return result;
}
