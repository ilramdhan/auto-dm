import { NextResponse, type NextRequest } from "next/server";
import { verifyApiKey } from "@/server/api-keys";
import { processCommentEvents } from "@/server/engine/process-comment";
import { AppError } from "@/server/errors";
import { errorResponse, noStore } from "@/server/instagram/http";
import { authenticateWebhook } from "@/server/instagram/inbound";
import { logger } from "@/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = logger("n8n");

/**
 * n8n relay. Requires `Authorization: Bearer <api key>` AND the original Meta
 * `X-Hub-Signature-256` over the original raw body (forwarded byte-for-byte). Processes synchronously:
 * `200 { results: [{ commentId, status, ruleId, matchedKeyword, skipReason, error }] }`.
 * Errors use `{ error: { code, message } }`: 401 UNAUTHORIZED (bad API key or signature),
 * 422 VALIDATION (bad/too large payload), 412 NOT_CONFIGURED (app secret not set), 500 INTERNAL.
 */
export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    if (!(await verifyApiKey(req.headers.get("authorization")))) {
      throw new AppError("UNAUTHORIZED", "Invalid or missing API key");
    }
    const { entries, events } = await authenticateWebhook(req);
    const results = await processCommentEvents(events, { source: "n8n" });
    log.info("n8n.events_processed", {
      entries,
      events: events.length,
      statuses: results.map((r) => r.status),
      durationMs: Date.now() - started,
    });
    return NextResponse.json(
      {
        results: results.map((r) => ({
          commentId: r.commentId,
          status: r.status,
          ruleId: r.ruleId,
          matchedKeyword: r.matchedKeyword,
          skipReason: r.skipReason,
          error: r.error,
        })),
      },
      { headers: noStore() },
    );
  } catch (err) {
    log.warn("n8n.events_rejected", {
      reason: err instanceof Error ? err.message : "unknown",
      durationMs: Date.now() - started,
    });
    return errorResponse(err, log, "n8n.events_failed");
  }
}
