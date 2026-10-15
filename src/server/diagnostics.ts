import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { logger } from "@/server/log";

export interface DbPing {
  ok: boolean;
  /** Round-trip time of `select 1` in ms (null when the database could not be reached). */
  latencyMs: number | null;
}

const log = logger("health");

/**
 * One `select 1` round trip. Not retried: the point is to measure the connection as it is.
 * Never throws and never exposes the error to the caller.
 */
export async function pingDb(): Promise<DbPing> {
  const started = performance.now();
  try {
    await db.execute(sql`select 1`);
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    log.error("health.db_unreachable", { err: err instanceof Error ? err.name : "unknown" });
    return { ok: false, latencyMs: null };
  }
}

/** Runs `fn` and returns its result with the elapsed time in ms. */
export async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const started = performance.now();
  const result = await fn();
  return { result, durationMs: Math.round(performance.now() - started) };
}

/** Vercel function region (e.g. `iad1`), or null outside Vercel. */
export function serverRegion(): string | null {
  return process.env.VERCEL_REGION ?? null;
}
