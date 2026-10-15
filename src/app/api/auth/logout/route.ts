import { NextResponse, type NextRequest } from "next/server";
import { publicBaseUrl } from "@/env";
import { logger } from "@/server/log";
import { noStore } from "@/server/instagram/http";
import { expectedOrigins, isSameOriginRequest } from "@/server/auth/same-origin";
import { signOutCurrentSession } from "@/server/auth/logout";
import { SESSION_COOKIE } from "@/server/auth/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = logger("auth");

/**
 * Sign out as a plain HTML form post (#87). Unlike the `logoutAction` Server Action it does not
 * depend on the client bundle, so it still works in a tab or installed app running an older build
 * (whose Server Action ids the new deployment no longer knows) and without JavaScript.
 *
 * Same-origin only (CSRF): a cross-site form cannot sign the user out.
 */
export async function POST(req: NextRequest) {
  const allowed = expectedOrigins(req.url, req.headers, publicBaseUrl());
  const sameOrigin = isSameOriginRequest({
    origin: req.headers.get("origin"),
    secFetchSite: req.headers.get("sec-fetch-site"),
    allowedOrigins: allowed,
  });
  if (!sameOrigin) {
    log.warn("logout.rejected", { reason: "cross_origin" });
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore() });
  }

  try {
    await signOutCurrentSession();
    log.info("logout", {});
  } catch (err) {
    // The cookie is still cleared (below and in signOutCurrentSession); only the revocation failed.
    log.error("logout.revoke_failed", { err: err instanceof Error ? err.name : "unknown" });
  }

  // 303 See Other: the browser follows with a GET. A relative Location keeps the user on the host
  // they used, also behind a reverse proxy that rewrites the request URL.
  const res = new NextResponse(null, { status: 303, headers: { ...noStore(), Location: "/login" } });
  // Same attributes as createSession (path "/"), so the browser replaces and expires that cookie.
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return res;
}
