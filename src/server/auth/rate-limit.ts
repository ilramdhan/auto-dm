import "server-only";
import { and, count, eq, gte, inArray, lt, or } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/server/db/client";
import { loginAttempts } from "@/server/db/schema";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

export function attemptKeys(ip: string, username: string): { ipKey: string; userKey: string } {
  return { ipKey: `ip:${ip}`, userKey: `user:${username.trim().toLowerCase()}` };
}

/** True when either the IP or the username exceeded the failure budget in the window. */
export async function isRateLimited(ip: string, username: string): Promise<boolean> {
  const { ipKey, userKey } = attemptKeys(ip, username);
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const rows = await db
    .select({ key: loginAttempts.key, n: count() })
    .from(loginAttempts)
    .where(and(inArray(loginAttempts.key, [ipKey, userKey]), gte(loginAttempts.createdAt, since)))
    .groupBy(loginAttempts.key);
  return rows.some((r) => r.n >= LOGIN_MAX_FAILURES);
}

export async function recordFailure(ip: string, username: string): Promise<void> {
  const { ipKey, userKey } = attemptKeys(ip, username);
  await db.insert(loginAttempts).values([{ key: ipKey }, { key: userKey }]);
  // Opportunistic cleanup of old rows (cheap thanks to the (key, created_at) index).
  if (Math.random() < 0.1) {
    await db
      .delete(loginAttempts)
      .where(lt(loginAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
  }
}

export async function clearFailures(ip: string, username: string): Promise<void> {
  const { ipKey, userKey } = attemptKeys(ip, username);
  await db.delete(loginAttempts).where(or(eq(loginAttempts.key, ipKey), eq(loginAttempts.key, userKey)));
}
