import "server-only";

/**
 * CSRF guard for cookie-authenticated form posts handled by plain route handlers (which, unlike
 * Server Actions, get no built-in origin check), e.g. `POST /api/auth/logout` (#87). Pure, so it can
 * be unit-tested.
 *
 * - `Sec-Fetch-Site` (sent by current browsers, not settable by pages) must be `same-origin`.
 * - Without it, `Origin` must match one of `allowedOrigins`.
 * - Neither header: rejected.
 */
export interface OriginCheck {
  origin: string | null;
  secFetchSite: string | null;
  allowedOrigins: readonly string[];
}

/** `scheme://host[:port]` in canonical form, or null when `raw` is not an http(s) origin. */
export function normalizeOrigin(raw: string | null | undefined): string | null {
  if (!raw || raw === "null") return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isSameOriginRequest({ origin, secFetchSite, allowedOrigins }: OriginCheck): boolean {
  const site = secFetchSite?.trim().toLowerCase();
  if (site && site !== "same-origin") return false;
  const actual = normalizeOrigin(origin);
  // Browsers send Origin on every POST; it must match when present.
  if (actual) return allowedOrigins.some((allowed) => normalizeOrigin(allowed) === actual);
  // No usable Origin: only trust the browser's own Sec-Fetch-Site.
  return site === "same-origin";
}

/**
 * Origins a request may legitimately come from: the request URL, the Host as seen through a reverse
 * proxy (`X-Forwarded-Host`/`-Proto`), and the configured public base URL.
 */
export function expectedOrigins(
  requestUrl: string,
  headers: Pick<Headers, "get">,
  publicBaseUrl: string | null,
): string[] {
  const origins = new Set<string>();
  const add = (value: string | null | undefined) => {
    const normalized = normalizeOrigin(value);
    if (normalized) origins.add(normalized);
  };
  add(requestUrl);
  const host = (headers.get("x-forwarded-host") ?? headers.get("host"))?.split(",")[0]?.trim();
  if (host) {
    let proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (proto !== "http" && proto !== "https") proto = normalizeOrigin(requestUrl)?.split(":")[0];
    if (proto) add(`${proto}://${host}`);
  }
  add(publicBaseUrl);
  return [...origins];
}
