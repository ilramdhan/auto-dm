import type { NextRequest } from "next/server";
import { verifyApiKey } from "@/server/api-keys";
import { AppError } from "@/server/errors";
import { errorResponse } from "@/server/instagram/http";
import { verificationResponse } from "@/server/instagram/inbound";
import { logger } from "@/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = logger("n8n");

/**
 * Lets n8n answer Meta's GET verification handshake: n8n forwards `hub.mode`, `hub.verify_token`
 * and `hub.challenge` with `Authorization: Bearer <api key>`; we return the challenge as
 * text/plain (200) when the verify token matches, else 403 text/plain. Bad API key → 401
 * `{ error: { code: "UNAUTHORIZED", message } }`.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await verifyApiKey(req.headers.get("authorization")))) {
      throw new AppError("UNAUTHORIZED", "Invalid or missing API key");
    }
    return await verificationResponse(req.nextUrl.searchParams);
  } catch (err) {
    return errorResponse(err, log, "n8n.verify_failed");
  }
}
