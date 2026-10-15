import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** Real signed requests are a few hundred bytes; anything much bigger is not from Meta. */
const MAX_SIGNED_REQUEST_LENGTH = 8_192;
/** base64url (optionally padded). Standard base64 `+` / `/` are rejected. */
const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

const userIdSchema = z.union([
  z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  z
    .number()
    .int()
    .nonnegative()
    .refine((n) => Number.isSafeInteger(n))
    .transform(String),
]);

const payloadSchema = z.object({
  algorithm: z.string().refine((a) => a.toUpperCase() === "HMAC-SHA256"),
  user_id: userIdSchema,
  issued_at: z.number().int().nonnegative().optional(),
});

export interface SignedRequest {
  /** Instagram-scoped id of the user who removed the app / asked for deletion. */
  userId: string;
  /** Unix seconds, when Meta included it. */
  issuedAt?: number;
}

/**
 * Parses and verifies a Meta `signed_request` (sent to the deauthorize and data deletion callbacks):
 * `<base64url signature>.<base64url JSON payload>`, where the signature is HMAC-SHA256 of the
 * *encoded* payload string keyed with the app secret. Returns `null` for anything malformed or
 * not signed with `appSecret`. The signature is compared in constant time.
 */
export function parseSignedRequest(signedRequest: string, appSecret: string): SignedRequest | null {
  if (!signedRequest || !appSecret || signedRequest.length > MAX_SIGNED_REQUEST_LENGTH) return null;
  const parts = signedRequest.split(".");
  if (parts.length !== 2) return null;
  const [encodedSig, encodedPayload] = parts as [string, string];
  if (!B64URL.test(encodedSig) || !B64URL.test(encodedPayload)) return null;

  const received = Buffer.from(encodedSig, "base64url");
  const expected = createHmac("sha256", appSecret).update(encodedPayload).digest();
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return null;
  return {
    userId: parsed.data.user_id,
    ...(parsed.data.issued_at !== undefined ? { issuedAt: parsed.data.issued_at } : {}),
  };
}
