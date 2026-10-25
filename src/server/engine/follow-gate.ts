import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { deliveries, rules, type Delivery, type InstagramAccount, type Rule } from "@/server/db/schema";
import { getAccessToken, getActiveAccount } from "@/server/instagram/account";
import { DM_MAX_CHARS } from "@/server/instagram/constants";
import { safeErrorMessage } from "@/server/instagram/graph";
import {
  sendDirectMessage,
  sendPostbackMessage,
  type PrivateReplyResult,
} from "@/server/instagram/messaging";
import { getUserFollowStatus } from "@/server/instagram/user-profile";
import type { PostbackEvent } from "@/server/instagram/webhook";
import { logger, type Logger } from "@/server/log";
import { getSetting } from "@/server/settings";
import { followGateTexts } from "@/lib/validation/rule";
import { parseFollowGatePayload } from "./follow-gate-payload";
import { templateKeyword } from "./match";
import { renderTemplate, truncateText } from "./template";

const rootLog = logger("follow_gate");

export type FollowGateOutcome =
  | "unlocked"
  | "unlocked_fail_open"
  | "not_following"
  | "ignored_payload"
  | "ignored_not_found"
  | "ignored_sender_mismatch"
  | "ignored_account_mismatch"
  | "ignored_not_pending"
  | "ignored_rule_deleted"
  | "ignored_disabled"
  | "send_failed";

type GateDelivery = Pick<
  Delivery,
  "id" | "igUserId" | "commenterId" | "commenterUsername" | "ruleId" | "matchedKeyword" | "followGateStatus"
>;
type GateRule = Pick<
  Rule,
  | "id"
  | "dmMessage"
  | "dmButtonTitle"
  | "dmButtonUrl"
  | "followGateMessage"
  | "followGateButtonTitle"
  | "followGateRetryMessage"
>;

/** Side effects of the handler, injectable for unit tests. */
export interface FollowGateDeps {
  processingEnabled: () => Promise<boolean>;
  getAccount: () => Promise<Pick<InstagramAccount, "igUserId" | "accessTokenEnc"> | null>;
  getToken: (account: Pick<InstagramAccount, "accessTokenEnc">) => string;
  getDelivery: (id: string) => Promise<GateDelivery | undefined>;
  getRule: (id: string) => Promise<GateRule | undefined>;
  /** `pending` → `unlocked` only if still pending. Returns true for exactly one caller. */
  claimUnlock: (deliveryId: string) => Promise<boolean>;
  /** Back to `pending` after a failed send, so the user can tap again. */
  revertUnlock: (deliveryId: string) => Promise<void>;
  recordUnlockedMessage: (deliveryId: string, messageId: string) => Promise<void>;
  isFollowing: (token: string, igsid: string) => Promise<boolean>;
  sendDirect: (
    token: string,
    igUserId: string,
    igsid: string,
    message: { text: string; button: { title: string; url: string } | null },
  ) => Promise<PrivateReplyResult>;
  sendPostback: (
    token: string,
    igUserId: string,
    igsid: string,
    input: { text: string; button: { title: string; payload: string } },
  ) => Promise<PrivateReplyResult>;
}

export const defaultFollowGateDeps: FollowGateDeps = {
  processingEnabled: async () => (await getSetting("processing.enabled")) !== false,
  getAccount: () => getActiveAccount(),
  getToken: (account) => getAccessToken(account),
  getDelivery: async (id) => {
    const [row] = await db.select().from(deliveries).where(eq(deliveries.id, id)).limit(1);
    return row;
  },
  getRule: async (id) => {
    const [row] = await db.select().from(rules).where(eq(rules.id, id)).limit(1);
    return row;
  },
  claimUnlock: async (deliveryId) => {
    const rows = await db
      .update(deliveries)
      .set({ followGateStatus: "unlocked", followGateUnlockedAt: new Date() })
      .where(and(eq(deliveries.id, deliveryId), eq(deliveries.followGateStatus, "pending")))
      .returning({ id: deliveries.id });
    return rows.length === 1;
  },
  revertUnlock: async (deliveryId) => {
    await db
      .update(deliveries)
      .set({ followGateStatus: "pending", followGateUnlockedAt: null })
      .where(and(eq(deliveries.id, deliveryId), eq(deliveries.followGateStatus, "unlocked")));
  },
  recordUnlockedMessage: async (deliveryId, messageId) => {
    await db.update(deliveries).set({ dmMessageId: messageId }).where(eq(deliveries.id, deliveryId));
  },
  isFollowing: (token, igsid) => getUserFollowStatus(token, igsid),
  sendDirect: (token, igUserId, igsid, message) => sendDirectMessage(token, igUserId, igsid, message),
  sendPostback: (token, igUserId, igsid, input) => sendPostbackMessage(token, igUserId, { id: igsid }, input),
};

/** The rule's normal DM for a delivery: same rendering and link button as the send path. */
export function unlockedDm(
  rule: Pick<Rule, "dmMessage" | "dmButtonTitle" | "dmButtonUrl">,
  delivery: Pick<Delivery, "commenterUsername" | "matchedKeyword">,
): { text: string; button: { title: string; url: string } | null } {
  const vars = {
    username: delivery.commenterUsername,
    keyword: templateKeyword(delivery.matchedKeyword ?? ""),
  };
  return {
    text: truncateText(renderTemplate(rule.dmMessage, vars).trim(), DM_MAX_CHARS),
    button:
      rule.dmButtonUrl && rule.dmButtonTitle ? { title: rule.dmButtonTitle, url: rule.dmButtonUrl } : null,
  };
}

/**
 * Handles a tap on a follow gate button (`messaging_postbacks`, payload `fg:<deliveryId>`).
 *
 * Checks the delivery is ours, pending and tapped by its commenter, then asks the User Profile API
 * whether the user follows us. Following (or the check failed: fail open) → claims the unlock
 * atomically (`pending` → `unlocked`, so a double tap sends once) and sends the rule's normal DM to
 * `recipient: { id }` inside the 24h window the tap opened; on send failure the claim is reverted.
 * Not following → re-sends the retry text with the same button. Never throws.
 */
export async function handleFollowGatePostback(
  event: PostbackEvent,
  opts: { log?: Logger; deps?: FollowGateDeps } = {},
): Promise<FollowGateOutcome> {
  const log = opts.log ?? rootLog;
  const deps = opts.deps ?? defaultFollowGateDeps;
  const done = (outcome: FollowGateOutcome, extra: Record<string, unknown> = {}) => {
    log.info("follow_gate.postback", { outcome, ...extra });
    return outcome;
  };

  const deliveryId = parseFollowGatePayload(event.payload);
  if (!deliveryId) return done("ignored_payload");

  let token: string | undefined;
  try {
    if (!(await deps.processingEnabled())) return done("ignored_disabled", { deliveryId });
    const account = await deps.getAccount();
    if (!account || !account.accessTokenEnc) return done("ignored_account_mismatch", { deliveryId });
    if (event.igUserId !== account.igUserId || event.recipientId !== account.igUserId)
      return done("ignored_account_mismatch", { deliveryId });

    const delivery = await deps.getDelivery(deliveryId);
    if (!delivery) return done("ignored_not_found", { deliveryId });
    if (delivery.igUserId && delivery.igUserId !== account.igUserId)
      return done("ignored_account_mismatch", { deliveryId });
    if (!delivery.commenterId || delivery.commenterId !== event.senderId)
      return done("ignored_sender_mismatch", { deliveryId });
    if (delivery.followGateStatus !== "pending") return done("ignored_not_pending", { deliveryId });
    if (!delivery.ruleId) return done("ignored_rule_deleted", { deliveryId });
    const rule = await deps.getRule(delivery.ruleId);
    if (!rule) return done("ignored_rule_deleted", { deliveryId });

    token = deps.getToken(account);
    let following: boolean;
    let failOpen = false;
    try {
      following = await deps.isFollowing(token, event.senderId);
    } catch (err) {
      // Fail open: a Meta outage must not strand real followers.
      following = true;
      failOpen = true;
      log.warn("follow_gate.check_failed", { deliveryId, err: safeErrorMessage(err, [token]) });
    }

    if (!following) {
      const gate = followGateTexts(rule);
      const vars = {
        username: delivery.commenterUsername,
        keyword: templateKeyword(delivery.matchedKeyword ?? ""),
      };
      const text = renderTemplate(gate.retryMessage, vars).trim() || gate.retryMessage;
      try {
        await deps.sendPostback(token, account.igUserId, event.senderId, {
          text,
          button: { title: gate.buttonTitle, payload: event.payload },
        });
      } catch (err) {
        log.warn("follow_gate.retry_send_failed", { deliveryId, err: safeErrorMessage(err, [token]) });
        return done("send_failed", { deliveryId });
      }
      return done("not_following", { deliveryId });
    }

    if (!(await deps.claimUnlock(deliveryId))) return done("ignored_not_pending", { deliveryId });
    const dm = unlockedDm(rule, delivery);
    try {
      const res = await deps.sendDirect(token, account.igUserId, event.senderId, dm);
      await deps.recordUnlockedMessage(deliveryId, res.messageId).catch(() => undefined);
    } catch (err) {
      await deps.revertUnlock(deliveryId).catch(() => undefined);
      log.warn("follow_gate.unlock_send_failed", { deliveryId, err: safeErrorMessage(err, [token]) });
      return done("send_failed", { deliveryId });
    }
    return done(failOpen ? "unlocked_fail_open" : "unlocked", { deliveryId });
  } catch (err) {
    log.error("follow_gate.error", { deliveryId, err: safeErrorMessage(err, [token]) });
    return done("send_failed", { deliveryId });
  }
}

/** Handles postbacks sequentially. Never throws. */
export async function handleFollowGatePostbacks(
  events: readonly PostbackEvent[],
  opts: { log?: Logger; deps?: FollowGateDeps } = {},
): Promise<FollowGateOutcome[]> {
  const out: FollowGateOutcome[] = [];
  for (const e of events) out.push(await handleFollowGatePostback(e, opts));
  return out;
}
