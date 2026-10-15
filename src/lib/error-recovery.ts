/**
 * Pure helpers for recovering from failed page loads (issues #64 and #75). Isomorphic: no DOM, no
 * storage access; callers pass the stored values in and persist what these return.
 *
 * Two recoveries, each attempted at most once per guard window so a persistent error still shows
 * the error card instead of looping:
 * - "reload": the open tab runs an older client bundle than the server (a new deploy). Old JS chunks
 *   are gone and old Server Action ids are unknown, so only a full page load fixes it.
 * - "retry": anything else (typically a stale database connection on the first request after the
 *   app was idle). Re-render the segment once with fresh server data.
 */

export type RecoveryAction = "reload" | "retry" | "show";

/** A reload for version skew is attempted at most once per this window (per tab). */
export const RELOAD_GUARD_MS = 5 * 60 * 1000;
/** An automatic retry is attempted at most once per this window (per tab and path). */
export const RETRY_GUARD_MS = 30 * 1000;

/** sessionStorage keys (per tab, cleared when the tab closes). */
export const STORAGE_KEYS = {
  reloadAt: "autodm:recovery:reload-at",
  retryAt: (path: string) => `autodm:recovery:retry-at:${path}`,
  /** Set right before a version-skew reload; read once after it to show "Updated to a new version". */
  updated: "autodm:recovery:updated",
} as const;

const SKEW_NAMES = new Set(["ChunkLoadError", "UnrecognizedActionError"]);

const SKEW_MESSAGE = new RegExp(
  [
    // webpack / Turbopack chunk loading
    "loading (?:css )?chunk \\S+ failed",
    "failed to load chunk",
    "chunkloaderror",
    // native dynamic import() in browsers
    "failed to fetch dynamically imported module",
    "error loading dynamically imported module",
    "importing a module script failed",
    // Server Actions from an older build
    "failed to find server action",
    "server action .{0,80}was not found on the server",
    // deployment id mismatch (Skew Protection / NEXT_DEPLOYMENT_ID)
    "deployment (?:id )?mismatch",
    "version skew",
  ].join("|"),
  "i",
);

function readNameAndMessage(err: unknown): { name: string; message: string } {
  if (typeof err === "string") return { name: "", message: err };
  if (!err || typeof err !== "object") return { name: "", message: "" };
  const e = err as { name?: unknown; message?: unknown };
  return {
    name: typeof e.name === "string" ? e.name : "",
    message: typeof e.message === "string" ? e.message : "",
  };
}

/** True when the error means the browser runs an older build than the server. */
export function isVersionSkewError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 3 && current; depth++) {
    const { name, message } = readNameAndMessage(current);
    if (SKEW_NAMES.has(name) || SKEW_MESSAGE.test(message)) return true;
    current = typeof current === "object" ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}

/** Parses a stored timestamp; anything invalid counts as "never". */
export function parseTimestamp(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** True when no attempt was made within `windowMs` before `now`. */
export function canAttempt(lastAt: number | null, now: number, windowMs: number): boolean {
  if (lastAt === null) return true;
  // A clock that moved backwards counts as a recent attempt (no loop on clock changes).
  const elapsed = now - lastAt;
  return elapsed < 0 ? false : elapsed >= windowMs;
}

export interface RecoveryInput {
  error: unknown;
  now: number;
  lastReloadAt: number | null;
  lastRetryAt: number | null;
}

/**
 * What an error boundary should do with `error`. Version skew reloads once; when the reload already
 * happened recently it falls back to a normal retry, then to showing the error card.
 */
export function decideRecovery({ error, now, lastReloadAt, lastRetryAt }: RecoveryInput): RecoveryAction {
  if (isVersionSkewError(error) && canAttempt(lastReloadAt, now, RELOAD_GUARD_MS)) return "reload";
  if (canAttempt(lastRetryAt, now, RETRY_GUARD_MS)) return "retry";
  return "show";
}
