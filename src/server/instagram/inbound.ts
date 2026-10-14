import "server-only";
import { AppError } from "@/server/errors";
import { ensureVerifyToken, getSetting } from "@/server/settings";
import { noStore } from "./http";
import {
  checkVerifyRequest,
  extractCommentEvents,
  MAX_WEBHOOK_BODY_BYTES,
  parseWebhookPayload,
  verifySignature,
  type CommentEvent,
} from "./webhook";

export const SIGNATURE_HEADER = "x-hub-signature-256";

export interface AuthenticatedWebhook {
  /** Number of `entry[]` items in the payload. */
  entries: number;
  events: CommentEvent[];
}

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
 * Throws {@link AppError}: VALIDATION (too large / bad payload), NOT_CONFIGURED (no app secret),
 * UNAUTHORIZED (bad or missing signature).
 */
export async function authenticateWebhook(req: Request): Promise<AuthenticatedWebhook> {
  const raw = await readRawBody(req);
  if (raw === null) throw new AppError("VALIDATION", "Payload too large");
  const appSecret = await getSetting("meta.appSecret");
  if (!appSecret) throw new AppError("NOT_CONFIGURED", "Instagram app secret is not configured");
  if (!verifySignature(raw, req.headers.get(SIGNATURE_HEADER), appSecret)) {
    throw new AppError("UNAUTHORIZED", "Invalid or missing X-Hub-Signature-256");
  }
  const payload = parseWebhookPayload(raw);
  if (!payload) throw new AppError("VALIDATION", "Invalid webhook payload");
  return { entries: payload.entry.length, events: extractCommentEvents(payload) };
}

/** Answers Meta's GET verification handshake (`hub.challenge` as text/plain, or 403). */
export async function verificationResponse(params: URLSearchParams): Promise<Response> {
  const challenge = checkVerifyRequest(params, await ensureVerifyToken());
  if (challenge === null) return new Response("Forbidden", { status: 403, headers: noStore("text/plain") });
  return new Response(challenge, { status: 200, headers: noStore("text/plain") });
}
