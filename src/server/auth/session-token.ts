import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

/**
 * Pure JWT helpers (no Next/DB imports) so they can be unit-tested.
 * Payload: `sub` = user id, `ver` = users.session_version at issue time.
 */
export const SESSION_COOKIE = "ard_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
// Legacy name (project was renamed to AutoDM). Do not change: existing sessions would be rejected.
const ISSUER = "auto-reply-ig";
const AUDIENCE = "auto-reply-ig:dashboard";

const payloadSchema = z.object({ sub: z.string().min(1), ver: z.number().int() });
export type SessionClaims = z.infer<typeof payloadSchema>;

export async function signSessionToken(
  claims: SessionClaims,
  key: Uint8Array,
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<string> {
  return new SignJWT({ ver: claims.ver })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key);
}

export async function verifySessionToken(token: string, key: Uint8Array): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const parsed = payloadSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
