import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { safeEqual } from "@/server/crypto";

/** Max accepted webhook body size (Meta batches are small; this is a DoS guard). */
export const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

/**
 * Verifies Meta's `X-Hub-Signature-256: sha256=<hex>` header: HMAC-SHA256 of the exact raw body
 * keyed with the app secret, compared in constant time.
 */
export function verifySignature(
  rawBody: string | Buffer,
  header: string | null | undefined,
  appSecret: string,
): boolean {
  if (!header || !appSecret) return false;
  const match = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!match) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const received = Buffer.from(match[1]!, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * Handles Meta's GET subscription handshake. Returns the `hub.challenge` to echo back, or `null`
 * when the mode/token don't match.
 */
export function checkVerifyRequest(params: URLSearchParams, expectedToken: string): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode !== "subscribe" || !token || challenge === null || !expectedToken) return null;
  if (!safeEqual(token, expectedToken)) return null;
  // Challenge is an integer string from Meta; restrict to a safe charset to avoid reflection.
  return /^[A-Za-z0-9_.-]{1,256}$/.test(challenge) ? challenge : null;
}

/* --------------------------------- payload --------------------------------- */

const id = z.union([z.string().min(1), z.number().int()]).transform(String);

/** `value` of a `comments` change. Unknown keys are stripped, not rejected. */
export const commentValueSchema = z.object({
  id,
  text: z.string().optional(),
  from: z.object({ id, username: z.string().optional() }),
  media: z.object({ id, media_product_type: z.string().optional() }).optional(),
  parent_id: id.optional(),
});

export const webhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      /** Our Instagram professional account id. */
      id,
      time: z.number().optional(),
      changes: z.array(z.object({ field: z.string(), value: z.unknown() })).optional(),
    }),
  ),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

/** Normalized comment event, the engine's input. */
export interface CommentEvent {
  commentId: string;
  text: string;
  /** Receiving (our) account id from `entry[].id`. */
  igUserId: string | null;
  fromId: string;
  fromUsername: string | null;
  mediaId: string | null;
  mediaProductType: string | null;
  parentId: string | null;
}

/** `entry[].id` values (the receiving account ids), for diagnostics. */
export function entryIds(payload: WebhookPayload): string[] {
  return payload.entry.map((e) => e.id);
}

/**
 * How many of `ids` are the connected account `igUserId`. `null` when no account is connected, so
 * the UI can tell "no account" apart from "sent for another account".
 */
export function countMatchedEntries(
  ids: readonly string[],
  igUserId: string | null | undefined,
): number | null {
  if (!igUserId) return null;
  return ids.filter((id) => id === igUserId).length;
}

/**
 * `JSON.parse` reviver: integers beyond `Number.MAX_SAFE_INTEGER` (17-digit Instagram ids sent as
 * JSON numbers) are kept as their exact source text instead of a rounded number, which the id schema
 * would reject and turn a real delivery into `invalid_payload`. Uses the reviver `context.source`
 * (Node 21+); without it the value is returned unchanged.
 */
function preserveLargeIntegers(_key: string, value: unknown, context?: { source?: string }): unknown {
  if (typeof value === "number" && Number.isInteger(value) && !Number.isSafeInteger(value)) {
    const src = context?.source;
    if (src && /^-?\d+$/.test(src)) return src;
  }
  return value;
}

/** Parses a raw webhook body. Returns `null` for invalid JSON or an unexpected shape. */
export function parseWebhookPayload(rawBody: string): WebhookPayload | null {
  let json: unknown;
  try {
    json = JSON.parse(rawBody, preserveLargeIntegers);
  } catch {
    return null;
  }
  const parsed = webhookPayloadSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/**
 * Extracts comment events from an Instagram webhook payload. Ignores non-Instagram objects,
 * other fields (mentions, messages, ...) and malformed comment values.
 */
export function extractCommentEvents(payload: WebhookPayload): CommentEvent[] {
  if (payload.object !== "instagram") return [];
  const events: CommentEvent[] = [];
  const seen = new Set<string>();
  for (const entry of payload.entry) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments") continue;
      const v = commentValueSchema.safeParse(change.value);
      if (!v.success || seen.has(v.data.id)) continue;
      seen.add(v.data.id);
      events.push({
        commentId: v.data.id,
        text: v.data.text ?? "",
        igUserId: entry.id,
        fromId: v.data.from.id,
        fromUsername: v.data.from.username ?? null,
        mediaId: v.data.media?.id ?? null,
        mediaProductType: v.data.media?.media_product_type ?? null,
        parentId: v.data.parent_id ?? null,
      });
    }
  }
  return events;
}
