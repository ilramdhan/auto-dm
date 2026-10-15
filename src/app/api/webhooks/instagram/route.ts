import { after, NextResponse, type NextRequest } from "next/server";
import { processCommentEvents } from "@/server/engine/process-comment";
import { errorResponse, noStore } from "@/server/instagram/http";
import { authenticateWebhook, rejectionResult, verificationResponse } from "@/server/instagram/inbound";
import { getRequestId, logger } from "@/server/log";
import { recordWebhookRequest, recordWebhookRequestLater } from "@/server/repos/webhook-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const rootLog = logger("webhook");

/** Meta webhook subscription handshake (`hub.challenge` echo). */
export async function GET(req: NextRequest) {
  const started = Date.now();
  const log = rootLog.child({ requestId: getRequestId(req.headers) });
  let res: Response;
  try {
    res = await verificationResponse(req.nextUrl.searchParams);
  } catch (err) {
    res = errorResponse(err, log, "webhook.verify_failed");
  }
  // Only record attempts that look like Meta's handshake, not random GETs (crawlers, uptime checks).
  if (req.nextUrl.searchParams.has("hub.mode")) {
    const status = res.status;
    log.info("webhook.verification", { status });
    recordWebhookRequestLater({
      kind: "verification",
      source: "direct",
      result: status === 200 ? "verified" : status === 403 ? "forbidden" : "error",
      statusCode: status,
      durationMs: Date.now() - started,
    });
  }
  return res;
}

/**
 * Meta webhook delivery. The signature is verified on the raw body, then we answer 200
 * immediately and process the comments after the response (`after()`), so Meta never times out.
 */
export async function POST(req: NextRequest) {
  const started = Date.now();
  const log = rootLog.child({ requestId: getRequestId(req.headers) });
  let inbound;
  try {
    inbound = await authenticateWebhook(req);
  } catch (err) {
    log.warn("webhook.rejected", {
      reason: err instanceof Error ? err.message : "unknown",
      durationMs: Date.now() - started,
    });
    const res = errorResponse(err, log, "webhook.failed");
    recordWebhookRequestLater({
      kind: "delivery",
      source: "direct",
      result: rejectionResult(err),
      statusCode: res.status,
      durationMs: Date.now() - started,
    });
    return res;
  }
  const { entries, entryIds, events } = inbound;
  const durationMs = Date.now() - started;
  log.info("webhook.received", { entries, events: events.length, durationMs });
  after(async () => {
    await recordWebhookRequest({
      kind: "delivery",
      source: "direct",
      result: "accepted",
      statusCode: 200,
      entries,
      entryIds,
      commentEvents: events.length,
      durationMs,
    });
    if (events.length === 0) return;
    const t0 = Date.now();
    try {
      const results = await processCommentEvents(events, { source: "webhook", log });
      log.info("webhook.processed", {
        events: results.length,
        statuses: results.map((r) => r.status),
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      // Only an infrastructure failure (e.g. DB outage) gets here; never log the payload.
      log.error("webhook.processing_failed", { err, durationMs: Date.now() - t0 });
    }
  });
  return NextResponse.json({ received: events.length }, { headers: noStore() });
}
