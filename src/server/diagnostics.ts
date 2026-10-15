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

/** Pages whose data takes longer than this (from the start of the request) log a `*.slow` warning. */
export const SLOW_PAGE_MS = 1500;

export type SectionTiming = { ms: number; ok: boolean };

export type SlowPageInfo = {
  /** Time until the slowest section settled, in ms. */
  durationMs: number;
  sections: Record<string, SectionTiming>;
  region: string | null;
};

/** Monotonic start mark for `watchSections` (a function so render code doesn't call `performance.now` itself). */
export function startTimer(): number {
  return performance.now();
}

/**
 * Times each named promise from `startedAt` (a `performance.now()` value). Once all have settled and
 * the slowest took `thresholdMs` or more, calls `onSlow` once with the total, per-section timings and
 * the server region. Never rejects. It also attaches a handler to every promise, so a section whose
 * error boundary already tripped cannot cause an unhandled rejection.
 */
export function watchSections(
  sections: Record<string, Promise<unknown>>,
  onSlow: (info: SlowPageInfo) => void,
  opts: { startedAt?: number; thresholdMs?: number } = {},
): Promise<void> {
  const startedAt = opts.startedAt ?? performance.now();
  const thresholdMs = opts.thresholdMs ?? SLOW_PAGE_MS;
  const settled = Object.entries(sections).map(([name, p]) => {
    const done = (ok: boolean) => [name, { ms: Math.round(performance.now() - startedAt), ok }] as const;
    return p.then(
      () => done(true),
      () => done(false),
    );
  });
  return Promise.all(settled)
    .then((timings) => {
      const durationMs = timings.reduce((max, [, t]) => Math.max(max, t.ms), 0);
      if (durationMs >= thresholdMs)
        onSlow({ durationMs, sections: Object.fromEntries(timings), region: serverRegion() });
    })
    .catch(() => {});
}
