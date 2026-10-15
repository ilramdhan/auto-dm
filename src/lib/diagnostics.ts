/** Database round-trip quality, from a measured `select 1` (see Settings → About and /api/health). */
export type DbLatencyLevel = "good" | "fair" | "slow";

/** Under this the function and the database are in the same region. */
export const DB_LATENCY_GOOD_MS = 50;
/** From this on every page pays it many times over: almost always a region mismatch. */
export const DB_LATENCY_SLOW_MS = 150;

export function classifyDbLatency(ms: number): DbLatencyLevel {
  if (ms < DB_LATENCY_GOOD_MS) return "good";
  if (ms < DB_LATENCY_SLOW_MS) return "fair";
  return "slow";
}
