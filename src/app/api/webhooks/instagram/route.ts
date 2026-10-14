import { after, NextResponse, type NextRequest } from "next/server";
import { processCommentEvents } from "@/server/engine/process-comment";
import { errorResponse, noStore } from "@/server/instagram/http";
import { authenticateWebhook, verificationResponse } from "@/server/instagram/inbound";
import { logger } from "@/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = logger("webhook");

/** Meta webhook subscription handshake (`hub.challenge` echo). */
export async function GET(req: NextRequest) {
  try {
    return await verificationResponse(req.nextUrl.searchParams);
  } catch (err) {
    return errorResponse(err, log, "webhook.verify_failed");
  }
}

/**
 * Meta webhook delivery. The signature is verified on the raw body, then we answer 200
 * immediately and process the comments after the response (`after()`), so Meta never times out.
 */
export async function POST(req: NextRequest) {
  const started = Date.now();
  let inbound;
  try {
    inbound = await authenticateWebhook(req);
  } catch (err) {
    log.warn("webhook.rejected", {
      reason: err instanceof Error ? err.message : "unknown",
      durationMs: Date.now() - started,
    });
    return errorResponse(err, log, "webhook.failed");
  }
  const { entries, events } = inbound;
  log.info("webhook.received", { entries, events: events.length, durationMs: Date.now() - started });
  if (events.length > 0) {
    after(async () => {
      const t0 = Date.now();
      try {
        const results = await processCommentEvents(events, { source: "webhook" });
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
  }
  return NextResponse.json({ received: events.length }, { headers: noStore() });
}
