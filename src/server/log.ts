import "server-only";

/**
 * Structured JSON logger (one line per event) — readable in Vercel/Supabase log drains and
 * greppable locally. Never pass tokens, secrets, passwords or full webhook bodies: known
 * sensitive keys are redacted defensively anyway.
 *
 * Usage:
 *   const log = logger("engine");
 *   log.info("comment.processed", { commentId, status, durationMs });
 *   log.error("graph.request_failed", { err, path });
 */
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN: Level =
  (process.env.LOG_LEVEL as Level | undefined) ?? (process.env.NODE_ENV === "production" ? "info" : "debug");
const SENSITIVE = /token|secret|password|authorization|cookie|signature|api[_-]?key/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return serializeError(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1),
    ]),
  );
}

export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const extra = Object.fromEntries(Object.entries(err).filter(([k]) => !SENSITIVE.test(k)));
    return {
      name: err.name,
      message: err.message,
      ...extra,
      stack: err.stack?.split("\n").slice(0, 6).join("\n"),
    };
  }
  return { message: String(err) };
}

function emit(level: Level, scope: string, event: string, data?: Record<string, unknown>) {
  if (ORDER[level] < ORDER[MIN]) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    event,
    ...(redact(data ?? {}) as object),
  });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export function logger(scope: string) {
  return {
    debug: (event: string, data?: Record<string, unknown>) => emit("debug", scope, event, data),
    info: (event: string, data?: Record<string, unknown>) => emit("info", scope, event, data),
    warn: (event: string, data?: Record<string, unknown>) => emit("warn", scope, event, data),
    error: (event: string, data?: Record<string, unknown>) => emit("error", scope, event, data),
  };
}
export type Logger = ReturnType<typeof logger>;
