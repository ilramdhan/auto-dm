import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { hashPassword, verifyPassword } from "./auth/password";
import { db } from "./db/client";
import { apiKeys } from "./db/schema";

/** Plaintext format: `ard_` + 32 random bytes base64url (43 chars). */
export const API_KEY_PREFIX = "ard_";
const API_KEY_RE = /^ard_[A-Za-z0-9_-]{43}$/;
/** Characters of the key stored in clear for display (e.g. "ard_Ab12Cd34"). */
const DISPLAY_PREFIX_LENGTH = 12;
/** Avoid a DB write on every request: `last_used_at` is updated at most once per minute. */
const LAST_USED_RESOLUTION_MS = 60_000;

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * Creates an API key. The plaintext `key` is returned once and never stored: only its non-secret
 * display prefix (used for lookup) and an argon2id hash (used for verification).
 */
export async function createApiKey(name: string): Promise<{ id: string; key: string }> {
  const trimmed = name.trim().slice(0, 100);
  if (!trimmed) throw new Error("API key name is required");
  const key = `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const [row] = await db
    .insert(apiKeys)
    .values({ name: trimmed, prefix: key.slice(0, DISPLAY_PREFIX_LENGTH), keyHash: await hashPassword(key) })
    .returning({ id: apiKeys.id });
  if (!row) throw new Error("Failed to create API key");
  return { id: row.id, key };
}

/** Lists all keys (newest first), without hashes. */
export async function listApiKeys(): Promise<ApiKeySummary[]> {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .orderBy(desc(apiKeys.createdAt));
}

/** Revokes a key (soft delete). Returns false when the key doesn't exist or was already revoked. */
export async function revokeApiKey(id: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const rows = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  return rows.length > 0;
}

/** Extracts the key from an `Authorization: Bearer <key>` header value. */
export function parseBearer(authorizationHeader: string | null | undefined): string | null {
  if (!authorizationHeader) return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(authorizationHeader.trim());
  return m?.[1] ?? null;
}

/**
 * Verifies an `Authorization: Bearer <key>` header. Returns the key's id/name when valid and not
 * revoked (and bumps `last_used_at`), otherwise `null`. Candidates are found by the non-secret
 * display prefix (48 random bits, so normally exactly one), then checked with argon2id.
 */
export async function verifyApiKey(
  authorizationHeader: string | null | undefined,
): Promise<{ id: string; name: string } | null> {
  const key = parseBearer(authorizationHeader);
  if (!key || !API_KEY_RE.test(key)) return null;
  const candidates = await db
    .select({ id: apiKeys.id, name: apiKeys.name, keyHash: apiKeys.keyHash, lastUsedAt: apiKeys.lastUsedAt })
    .from(apiKeys)
    .where(and(eq(apiKeys.prefix, key.slice(0, DISPLAY_PREFIX_LENGTH)), isNull(apiKeys.revokedAt)))
    .limit(5);
  let row: (typeof candidates)[number] | undefined;
  for (const candidate of candidates) {
    if (await verifyPassword(candidate.keyHash, key)) {
      row = candidate;
      break;
    }
  }
  if (!row) return null;
  const now = new Date();
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await db.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, row.id));
  }
  return { id: row.id, name: row.name };
}
