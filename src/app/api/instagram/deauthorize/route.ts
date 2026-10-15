import { NextResponse, type NextRequest } from "next/server";
import { deauthorizeUser, readSignedRequest } from "@/server/instagram/data-deletion";
import { noStore } from "@/server/instagram/http";
import { logger } from "@/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = logger("deauthorize");

/**
 * Meta "Deauthorize callback URL": called with a `signed_request` when a user removes the app from
 * their Instagram settings. The connected account (if it's theirs) is disconnected locally.
 */
export async function POST(req: NextRequest) {
  try {
    const result = await readSignedRequest(req);
    if (!result.ok) {
      log.warn("deauthorize.rejected", { reason: result.reason });
      return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: noStore() });
    }
    const matched = await deauthorizeUser(result.request.userId);
    log.info("deauthorize.processed", { accountMatched: matched });
    return NextResponse.json({ success: true }, { headers: noStore() });
  } catch (err) {
    log.error("deauthorize.failed", { err: err instanceof Error ? err.name : "unknown" });
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers: noStore() });
  }
}
