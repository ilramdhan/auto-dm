import { NextResponse, type NextRequest } from "next/server";
import { verifyApiKey } from "@/server/api-keys";
import { processCommentEvents } from "@/server/engine/process-comment";
import { authenticateWebhook, noStore } from "@/server/instagram/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * n8n relay. Requires `Authorization: Bearer <api key>` AND the original Meta
 * `X-Hub-Signature-256` over the original raw body (forwarded unchanged). Processes synchronously:
 * `200 { results: [{ commentId, status, ruleId, matchedKeyword, skipReason, error }] }`.
 * Errors: `401 { error: "invalid_api_key" | "invalid_signature" }`, `400 invalid_payload`,
 * `413 payload_too_large`, `503 not_configured` (Meta app secret not set).
 */
export async function POST(req: NextRequest) {
  if (!(await verifyApiKey(req.headers.get("authorization")))) {
    return NextResponse.json({ error: "invalid_api_key" }, { status: 401, headers: noStore() });
  }
  const inbound = await authenticateWebhook(req);
  if (!inbound.ok) {
    return NextResponse.json({ error: inbound.error }, { status: inbound.status, headers: noStore() });
  }
  const results = await processCommentEvents(inbound.events, { source: "n8n" });
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
}
