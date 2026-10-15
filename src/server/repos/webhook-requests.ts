import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/server/db/client";
import { webhookRequests, type WebhookRequest } from "@/server/db/schema";
import { getActiveAccount } from "@/server/instagram/account";
import { countMatchedEntries } from "@/server/instagram/webhook";
import { logger } from "@/server/log";
import {
  createThrottle,
  WEBHOOK_LOG_KEEP_DELIVERIES,
  WEBHOOK_LOG_KEEP_VERIFICATIONS,
  type WebhookRequestKind,
  type WebhookRequestResult,
  type WebhookRequestSource,
} from "@/lib/webhook-diagnostics";

const log = logger("webhook");

/**
 * Rejected requests are unauthenticated, so cap how many are written per instance: enough to show
 * the problem in Settings, not enough to let someone flood the table.
 */
const rejectedThrottle = createThrottle(20, 60_000);

export interface RecordWebhookRequestInput {
  kind: WebhookRequestKind;
  source: WebhookRequestSource;
  result: WebhookRequestResult;
  statusCode: number;
  entries?: number | null;
  commentEvents?: number | null;
  /** `entry[].id` values; compared with the connected account to fill `matched_entries`. */
  entryIds?: readonly string[] | null;
  durationMs?: number | null;
}

/**
 * Records one inbound webhook request (no body, no headers, no tokens) and prunes the table to the
 * newest rows. Best-effort: never throws, so callers can fire-and-forget it in `after()`.
 */
export async function recordWebhookRequest(input: RecordWebhookRequestInput): Promise<void> {
  try {
    const authenticated = input.result === "accepted" || input.result === "verified";
    if (!authenticated && !rejectedThrottle()) return;
    let matchedEntries: number | null = null;
    if (input.entryIds) {
      const account = await getActiveAccount();
      matchedEntries = countMatchedEntries(input.entryIds, account?.igUserId);
    }
    await db.insert(webhookRequests).values({
      kind: input.kind,
      source: input.source,
      result: input.result,
      statusCode: input.statusCode,
      entries: input.entries ?? null,
      commentEvents: input.commentEvents ?? null,
      matchedEntries,
      durationMs: input.durationMs ?? null,
    });
    await pruneWebhookRequests(input.kind);
  } catch (err) {
    log.warn("webhook.record_failed", { err: err instanceof Error ? err.message : "unknown" });
  }
}

/** Keeps the newest N rows of `kind` (ring buffer). */
export async function pruneWebhookRequests(kind: WebhookRequestKind): Promise<void> {
  const keep = kind === "delivery" ? WEBHOOK_LOG_KEEP_DELIVERIES : WEBHOOK_LOG_KEEP_VERIFICATIONS;
  await db.execute(sql`
    delete from ${webhookRequests}
    where ${webhookRequests.kind} = ${kind}
      and ${webhookRequests.id} not in (
        select ${webhookRequests.id} from ${webhookRequests}
        where ${webhookRequests.kind} = ${kind}
        order by ${webhookRequests.createdAt} desc
        limit ${keep}
      )`);
}

export async function listWebhookRequests(
  kind?: WebhookRequestKind,
  limit = WEBHOOK_LOG_KEEP_DELIVERIES,
): Promise<WebhookRequest[]> {
  return db
    .select()
    .from(webhookRequests)
    .where(kind ? eq(webhookRequests.kind, kind) : undefined)
    .orderBy(desc(webhookRequests.createdAt))
    .limit(limit);
}

/**
 * Schedules {@link recordWebhookRequest} after the response is sent (`after()`), so recording never
 * delays the webhook. Outside a request scope (scripts, tests) it runs detached instead.
 */
export function recordWebhookRequestLater(input: RecordWebhookRequestInput): void {
  const task = () => recordWebhookRequest(input);
  try {
    after(task);
  } catch {
    void task();
  }
}
