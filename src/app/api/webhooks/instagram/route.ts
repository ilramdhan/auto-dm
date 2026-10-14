import { after, NextResponse, type NextRequest } from "next/server";
import { processCommentEvents } from "@/server/engine/process-comment";
import { authenticateWebhook, noStore, verificationResponse } from "@/server/instagram/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Meta webhook subscription handshake. */
export async function GET(req: NextRequest) {
  return verificationResponse(req.nextUrl.searchParams);
}

/**
 * Meta webhook delivery. The signature is verified on the raw body, then we answer 200
 * immediately and process the comments after the response (`after()`), so Meta never times out.
 */
export async function POST(req: NextRequest) {
  const inbound = await authenticateWebhook(req);
  if (!inbound.ok) {
    return NextResponse.json({ error: inbound.error }, { status: inbound.status, headers: noStore() });
  }
  if (inbound.events.length > 0) {
    after(async () => {
      try {
        await processCommentEvents(inbound.events, { source: "webhook" });
      } catch (err) {
        // Only a DB outage gets here; never log the payload.
        console.error("[webhook] processing failed:", err instanceof Error ? err.message : "unknown error");
      }
    });
  }
  return NextResponse.json({ received: inbound.events.length }, { headers: noStore() });
}
