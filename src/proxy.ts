import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap edge gate: dashboard routes without a session cookie are sent to /login.
 * Real validation (signature, expiry, session_version, must-change-password) happens in
 * `requireUser()` on the server — this only avoids rendering work for anonymous visitors.
 * Keep the cookie name in sync with src/server/auth/session-token.ts.
 */
const SESSION_COOKIE = "ard_session";
const PROTECTED = ["/dashboard", "/campaigns", "/analytics", "/activity", "/settings", "/change-password"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !req.cookies.has(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/dashboard" && pathname !== "/change-password")
      url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  // Per-request nonce CSP: Next.js applies the nonce to its own scripts when it sees this header on
  // the request; our layout passes it to next-themes' inline script. Instagram media/avatars come
  // from Meta's CDNs. Dev needs 'unsafe-eval' for React Refresh.
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.cdninstagram.com https://*.fbcdn.net",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  // Baseline security headers for HTML pages (API routes set their own).
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  return res;
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
