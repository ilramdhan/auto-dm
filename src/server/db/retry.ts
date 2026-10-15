import "server-only";
import { logger } from "@/server/log";

/**
 * Connection-level failures: the query never reached the database (or the socket died before an
 * answer came back), so running a read again on a fresh connection is safe.
 *
 * Typical cause: the transaction pooler closed a pooled socket while the serverless instance was
 * frozen; the first query after a cold/idle period then fails with `CONNECTION_CLOSED`/`ECONNRESET`.
 */
const TRANSIENT_CODES = new Set([
  // postgres.js
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  "CONNECT_TIMEOUT",
  // Node sockets / DNS
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "EPIPE",
  "ETIMEDOUT",
  "EAI_AGAIN",
  // SQLSTATE class 08 (connection exception) and server/pooler shutdown or restart
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "57P01",
  "57P02",
  "57P03",
]);

const TRANSIENT_MESSAGE =
  /connection terminated|connection ended|connection closed|connection reset|socket hang up|ECONNRESET|ETIMEDOUT|CONNECT_TIMEOUT|CONNECTION_CLOSED|CONNECTION_ENDED|CONNECTION_DESTROYED|server closed the connection unexpectedly|terminating connection due to administrator command/i;

const MAX_CAUSE_DEPTH = 5;

/**
 * True when `err` (or an error in its `cause` chain, e.g. Drizzle's `DrizzleQueryError` wrapping the
 * driver error) is a connection-level failure. Query errors (syntax, constraint, permission) are not.
 * Only the first line of a message is inspected: Drizzle appends SQL and params after it.
 */
export function isTransientDbError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth++) {
    if (typeof current !== "object") return false;
    const e = current as { code?: unknown; errno?: unknown; message?: unknown; cause?: unknown };
    for (const v of [e.code, e.errno]) {
      if (typeof v === "string" && TRANSIENT_CODES.has(v)) return true;
    }
    if (typeof e.message === "string" && TRANSIENT_MESSAGE.test(e.message.split("\n")[0] ?? "")) return true;
    current = e.cause;
  }
  return false;
}

/** The error's code (own or from its cause), for logs. Never the message: it can contain SQL. */
function errorCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current && typeof current === "object"; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code.slice(0, 50);
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Calls slower than this are logged as `db.slow` (cheap visibility for region mismatches). */
export const SLOW_DB_MS = 1500;

const log = logger("db");

export interface DbRetryOptions {
  /** Short, static name for logs (e.g. "auth.currentUser"). Never include user data. */
  label: string;
  /** Number of extra attempts after a transient failure. Default 1. */
  retries?: number;
  /** Wait before retrying, in ms. Default 50. */
  delayMs?: number;
}

/**
 * Runs `fn` and retries it once when it fails with a connection-level error (see
 * `isTransientDbError`). The failed socket is dropped by postgres.js, so the retry opens a fresh one.
 *
 * Use ONLY for reads or idempotent writes: a dropped connection can hide a write that did commit.
 * Never wrap a transaction body partially; wrap the whole `db.transaction(...)` call or nothing.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, opts: DbRetryOptions): Promise<T> {
  const retries = opts.retries ?? 1;
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await fn();
      const durationMs = Date.now() - started;
      if (durationMs >= SLOW_DB_MS)
        log.warn("db.slow", { label: opts.label, durationMs, attempts: attempt + 1 });
      return result;
    } catch (err) {
      if (attempt >= retries || !isTransientDbError(err)) throw err;
      log.warn("db.retry", { label: opts.label, attempt: attempt + 1, code: errorCode(err) });
      const delay = opts.delayMs ?? 50;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/**
 * Wraps a read-only async function with `withDbRetry`. The whole function runs again on a
 * connection-level failure, so it must not write.
 */
export function retryable<A extends unknown[], R>(
  label: string,
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return (...args: A) => withDbRetry(() => fn(...args), { label });
}
