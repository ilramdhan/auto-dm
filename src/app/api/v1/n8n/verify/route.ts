import { NextResponse, type NextRequest } from "next/server";
import { verifyApiKey } from "@/server/api-keys";
import { noStore, verificationResponse } from "@/server/instagram/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lets n8n answer Meta's GET verification handshake: n8n forwards `hub.mode`, `hub.verify_token`
 * and `hub.challenge` with `Authorization: Bearer <api key>`; we return the challenge as
 * text/plain (200) when the verify token matches, else 403 (401 for a bad API key).
 */
export async function GET(req: NextRequest) {
  if (!(await verifyApiKey(req.headers.get("authorization")))) {
    return NextResponse.json({ error: "invalid_api_key" }, { status: 401, headers: noStore() });
  }
  return verificationResponse(req.nextUrl.searchParams);
}
