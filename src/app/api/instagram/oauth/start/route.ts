import { NextResponse } from "next/server";
import { appUrl } from "@/env";
import { requireUser } from "@/server/auth/guard";
import {
  buildAuthorizeUrl,
  createOAuthState,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_S,
  OAuthFlowError,
} from "@/server/instagram/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts "Connect Instagram": sets a signed CSRF state cookie and redirects to Instagram. */
export async function GET() {
  await requireUser();
  const { state, cookieValue } = createOAuthState();
  let authorizeUrl: string;
  try {
    authorizeUrl = await buildAuthorizeUrl(state);
  } catch (err) {
    const code = err instanceof OAuthFlowError ? err.code : "missing_app_credentials";
    return NextResponse.redirect(new URL(`/settings?tab=instagram&error=${code}`, appUrl()), 303);
  }
  const res = NextResponse.redirect(authorizeUrl, 303);
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(OAUTH_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    secure: appUrl().startsWith("https://"),
    // Lax: the cookie must accompany the top-level GET redirect back from instagram.com.
    sameSite: "lax",
    path: "/api/instagram/oauth",
    maxAge: OAUTH_STATE_MAX_AGE_S,
  });
  return res;
}
