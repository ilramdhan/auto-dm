import "server-only";
import { ensureVerifyToken, getSetting } from "@/server/settings";
import { checkVerifyRequest, extractCommentEvents, MAX_WEBHOOK_BODY_BYTES, parseWebhookPayload, verifySignature, type CommentEvent } from "./webhook";

export const SIGNATURE_HEADER = "x-hub-signature-256";

export type InboundResult =
  | { ok: true; events: CommentEvent[] }
  | { ok: false; status: number; error: "payload_too_large" | "not_configured" | "invalid_signature" | "invalid_payload" };

/** Reads the request body as raw text, enforcing {@link MAX_WEBHOOK_BODY_BYTES}. */
export async function readRawBody(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_WEBHOOK_BODY_BYTES) return null;
  const text = await req.text();
  return Buffer.byteLength(text, "utf8") > MAX_WEBHOOK_BODY_BYTES ? null : text;
}

/**
 * Shared POST pipeline for Meta webhooks (direct or relayed by n8n): size limit → signature check
 * against `meta.appSecret` on the exact raw body → Zod parse → comment events.
 */
export async function authenticateWebhook(req: Request): Promise<InboundResult> {
  const raw = await readRawBody(req);
  if (raw === null) return { ok: false, status: 413, error: "payload_too_large" };
  const appSecret = await getSetting("meta.appSecret");
  if (!appSecret) return { ok: false, status: 503, error: "not_configured" };
  if (!verifySignature(raw, req.headers.get(SIGNATURE_HEADER), appSecret)) {
    return { ok: false, status: 401, error: "invalid_signature" };
  }
  const payload = parseWebhookPayload(raw);
  if (!payload) return { ok: false, status: 400, error: "invalid_payload" };
  return { ok: true, events: extractCommentEvents(payload) };
}

/** Answers Meta's GET verification handshake (`hub.challenge` as text/plain, or 403). */
export async function verificationResponse(params: URLSearchParams): Promise<Response> {
  const challenge = checkVerifyRequest(params, await ensureVerifyToken());
  if (challenge === null) return new Response("Forbidden", { status: 403, headers: noStore("text/plain") });
  return new Response(challenge, { status: 200, headers: noStore("text/plain") });
}

/** Common no-cache headers. */
export function noStore(contentType?: string): HeadersInit {
  return { "Cache-Control": "no-store", ...(contentType ? { "Content-Type": `${contentType}; charset=utf-8` } : {}) };
}
