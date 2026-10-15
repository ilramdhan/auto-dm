/**
 * Pure helpers for noticing that an open tab or installed PWA runs an older build than the server
 * (#87). Isomorphic: no DOM or storage access; callers pass the values in.
 */
import { z } from "zod";
import { normalizeBuildId } from "./build-id";
import { canAttempt } from "./error-recovery";

export const VERSION_ENDPOINT = "/api/version";
/** Checks triggered by the app becoming visible/focused again run at most this often. */
export const VERSION_CHECK_MIN_INTERVAL_MS = 60 * 1000;
/** While the app stays visible the version is checked on this interval. */
export const VERSION_POLL_INTERVAL_MS = 5 * 60 * 1000;
/** A client navigation that has not committed after this long is treated as stuck. */
export const NAVIGATION_WATCHDOG_MS = 10 * 1000;

const versionResponseSchema = z.object({
  version: z.string().max(50),
  buildId: z.string().max(200),
});

export type VersionInfo = { version: string; buildId: string };

/** Validates a `/api/version` response body; anything unexpected is null ("unknown"). */
export function parseVersionResponse(body: unknown): VersionInfo | null {
  const parsed = versionResponseSchema.safeParse(body);
  if (!parsed.success) return null;
  const buildId = normalizeBuildId(parsed.data.buildId);
  return buildId ? { version: parsed.data.version, buildId } : null;
}

/** True only when both ids are known and differ. Unknown ids never trigger a reload. */
export function isOutdatedBuild(
  clientBuildId: string | null | undefined,
  serverBuildId: string | null | undefined,
): boolean {
  const client = normalizeBuildId(clientBuildId);
  const server = normalizeBuildId(serverBuildId);
  return client !== null && server !== null && client !== server;
}

/** Throttle for event-triggered version checks (a clock that moved backwards waits). */
export function shouldCheckVersion(
  lastCheckAt: number | null,
  now: number,
  minIntervalMs: number = VERSION_CHECK_MIN_INTERVAL_MS,
): boolean {
  return canAttempt(lastCheckAt, now, minIntervalMs);
}

/** `pathname + search` of a URL: what a client navigation commits (the hash is ignored). */
export function navigationKey(url: URL): string {
  return `${url.pathname}${url.search}`;
}

export interface LinkClick {
  /** Resolved absolute href of the clicked anchor. */
  href: string;
  /** `location.href` at the time of the click. */
  currentHref: string;
  button: number;
  modifierKey: boolean;
  target: string | null;
  download: boolean;
}

/**
 * The navigation key a link click starts a client navigation to, or null when the click does not
 * start one (new tab, download, other origin, same page or hash-only change, non-http link).
 */
export function clientNavigationTarget(click: LinkClick): string | null {
  if (click.button !== 0 || click.modifierKey || click.download) return null;
  if (click.target && click.target !== "_self") return null;
  let to: URL;
  let from: URL;
  try {
    to = new URL(click.href);
    from = new URL(click.currentHref);
  } catch {
    return null;
  }
  if (to.protocol !== "http:" && to.protocol !== "https:") return null;
  if (to.origin !== from.origin) return null;
  const key = navigationKey(to);
  return key === navigationKey(from) ? null : key;
}
