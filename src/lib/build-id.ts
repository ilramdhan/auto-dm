/**
 * Build identity shared by the server (`/api/version`) and the client bundle (#87). Resolved once in
 * next.config.ts and inlined at build time as `NEXT_PUBLIC_BUILD_ID`, so the browser can tell when
 * it runs an older build than the server. Pure: no Next or DOM imports (next.config.ts imports it).
 */

const MAX_LENGTH = 200;

/** Trims and validates a build id; empty, oversized or placeholder values count as "unknown". */
export function normalizeBuildId(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (!id || id.length > MAX_LENGTH || ["undefined", "null", "unknown"].includes(id)) return null;
  return /^[\w.:-]+$/.test(id) ? id : null;
}

/**
 * The id of this build: the Vercel deployment id, else the git commit, else `fallback` (a value
 * generated once per `next build`, which covers Docker and other self-hosted builds).
 */
export function resolveBuildId(env: Record<string, string | undefined>, fallback: string): string {
  return (
    normalizeBuildId(env.VERCEL_DEPLOYMENT_ID) ??
    normalizeBuildId(env.VERCEL_GIT_COMMIT_SHA) ??
    normalizeBuildId(fallback) ??
    "unknown"
  );
}
