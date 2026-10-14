import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap edge gate: dashboard routes without a session cookie are sent to /login.
 * Real validation (signature, expiry, session_version, must-change-password) happens in
 * `requireUser()` on the server — this only avoids rendering work for anonymous visitors.
 * Keep the cookie name in sync with src/server/auth/session-token.ts.
 */
const SESSION_COOKIE = "ard_session";
const PROTECTED = ["/dashboard", "/campaigns", "/analytics", "/activity", "/settings", "/change-password"];

export function middleware(req: NextRequest) {
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

  const res = NextResponse.next();
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
