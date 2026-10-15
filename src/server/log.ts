import "server-only";

/**
 * Structured JSON logger (one line per event) — readable in Vercel/Docker logs and greppable
 * locally. Never pass tokens, secrets, passwords or full webhook bodies: sensitive keys are
 * redacted defensively anyway (see `redact`).
 *
 * Line shape: `{ time, ts, level, scope, msg, event, ...context, ...fields }`.
 * `time` is the ISO timestamp and `msg` the event name; `ts` and `event` are kept as aliases so
 * existing log searches keep working.
 *
 * Usage:
 *   const log = logger("engine");
 *   log.info("comment.processed", { commentId, status, durationMs });
 *   log.error("graph.request_failed", { err, path });
 *   const rlog = log.child({ requestId });   // every line now carries requestId
 */
export type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Parses `LOG_LEVEL`; unset → debug in development, info otherwise; invalid → info. */
export function parseLogLevel(raw: string | undefined, nodeEnv: string | undefined): Level {
  const v = raw?.trim().toLowerCase();
  if (v === "debug" || v === "info" || v === "warn" || v === "error") return v;
  if (v) return "info"; // set but invalid
  return nodeEnv === "development" ? "debug" : "info";
}

function minLevel(): Level {
  return parseLogLevel(process.env.LOG_LEVEL, process.env.NODE_ENV);
}

/** Stack traces are only logged outside production or when explicitly running at debug. */
function includeStack(): boolean {
  return process.env.NODE_ENV !== "production" || minLevel() === "debug";
}

const SENSITIVE =
  /token|secret|password|authorization|cookie|signature|signed_request|api[_-]?key|app_secret|verify_token/i;
const REDACTED = "[redacted]";
export const MAX_STRING = 500;
const MAX_DEPTH = 5;
const MAX_ITEMS = 50;

function cap(s: string, max = MAX_STRING): string {
  return s.length > max ? `${s.slice(0, max)}…[truncated ${s.length - max}]` : s;
}

/** Drizzle/pg messages append the bound parameters (`params: ...`); never log those. */
function safeMessage(message: string): string {
  const i = message.search(/\n?\s*params:/i);
  return cap(i >= 0 ? message.slice(0, i) : message);
}

/**
 * Error → plain object: name, message (bound SQL params stripped), code/status/digest when
 * primitive, `cause` as its name only (causes can carry SQL params), and a short stack when allowed.
 */
export function serializeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { message: cap(String(err)) };
  const out: Record<string, unknown> = { name: err.name, message: safeMessage(err.message) };
  const props = err as Error & { code?: unknown; status?: unknown; digest?: unknown; cause?: unknown };
  for (const key of ["code", "status", "digest"] as const) {
    const v = props[key];
    if (typeof v === "string") out[key] = cap(v, 100);
    else if (typeof v === "number") out[key] = v;
  }
  if (props.cause !== undefined) {
    out.cause = props.cause instanceof Error ? props.cause.name : typeof props.cause;
  }
  if (includeStack() && err.stack) {
    // Frames only: the header lines repeat the raw message, which may contain SQL params.
    const frames = err.stack.split("\n").filter((l) => /^\s+at /.test(l));
    out.stack = cap(frames.slice(0, 5).join("\n"), 1500);
  }
  return out;
}

/**
 * Pure, deep redaction used before serializing: sensitive keys → "[redacted]", Errors →
 * `serializeError`, long strings truncated, depth/array size capped, circular refs replaced.
 */
export function redact(value: unknown, depth = 0, ancestors: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === "string") return cap(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Error) return serializeError(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (ancestors.has(value)) return "[circular]";
  if (depth >= MAX_DEPTH) return "[max-depth]";
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((v) => redact(v, depth + 1, ancestors));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_ITEMS)) {
      out[k] = SENSITIVE.test(k) ? REDACTED : redact(v, depth + 1, ancestors);
    }
    return out;
  } finally {
    ancestors.delete(value);
  }
}

type Fields = Record<string, unknown>;

function emit(level: Level, scope: string, event: string, context: Fields, data?: Fields) {
  if (ORDER[level] < ORDER[minLevel()]) return;
  const time = new Date().toISOString();
  const fields = redact({ ...context, ...(data ?? {}) }) as Fields;
  const reserved = { time, ts: time, level, scope, msg: event, event };
  // Reserved keys keep their position and always win over same-named fields.
  const entry: Fields = Object.assign({ ...reserved, ...fields }, reserved);
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(JSON.stringify(entry));
}

export interface Logger {
  debug: (event: string, data?: Fields) => void;
  info: (event: string, data?: Fields) => void;
  warn: (event: string, data?: Fields) => void;
  error: (event: string, data?: Fields) => void;
  /** New logger that adds `context` (e.g. `{ requestId }`) to every line. */
  child: (context: Fields) => Logger;
}

export function logger(scope: string, context: Fields = {}): Logger {
  return {
    debug: (event, data) => emit("debug", scope, event, context, data),
    info: (event, data) => emit("info", scope, event, context, data),
    warn: (event, data) => emit("warn", scope, event, context, data),
    error: (event, data) => emit("error", scope, event, context, data),
    child: (extra) => logger(scope, { ...context, ...extra }),
  };
}

/** Request correlation id: `x-vercel-id`, else `x-request-id`, else a fresh UUID. */
export function getRequestId(headers: { get(name: string): string | null }): string {
  for (const name of ["x-vercel-id", "x-request-id"]) {
    const v = headers.get(name)?.trim();
    if (v) return v.slice(0, 100);
  }
  return crypto.randomUUID();
}
