import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/env";
import { requireUser } from "@/server/auth/guard";
import { safeErrorMessage } from "@/server/instagram/graph";
import { getRequestId, logger } from "@/server/log";
import {
  completeOAuth,
  OAUTH_STATE_COOKIE,
  OAuthFlowError,
  verifyOAuthState,
} from "@/server/instagram/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const rootLog = logger("oauth");

function back(query: string): NextResponse {
  const res = NextResponse.redirect(new URL(`/settings?tab=instagram&${query}`, appUrl()), 303);
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/api/instagram/oauth", maxAge: 0 });
  return res;
}

/**
 * Instagram redirects here with `?code&state` (or `?error=access_denied`). Verifies the CSRF
 * state, exchanges the code for a long-lived token, stores the account and subscribes webhooks.
 * Redirects to `/settings?tab=instagram&connected=1` (`&warning=subscribe_failed` if the webhook
 * subscription failed) or `/settings?tab=instagram&error=<code>`.
 */
export async function GET(req: NextRequest) {
  await requireUser();
  const log = rootLog.child({ requestId: getRequestId(req.headers) });
  const params = req.nextUrl.searchParams;
  if (!verifyOAuthState(params.get("state"), req.cookies.get(OAUTH_STATE_COOKIE)?.value)) {
    return back("error=invalid_state");
  }
  if (params.get("error")) return back("error=access_denied");
  const code = params.get("code");
  if (!code) return back("error=missing_code");

  try {
    const { account, subscribed } = await completeOAuth(code);
    log.info("oauth.connected", { igUserId: account.igUserId, username: account.username, subscribed });
    return back(subscribed ? "connected=1" : "connected=1&warning=subscribe_failed");
  } catch (err) {
    const code = err instanceof OAuthFlowError ? err.code : "token_exchange_failed";
    const cause = err instanceof OAuthFlowError ? err.cause : err;
    log.warn("oauth.connect_failed", { reason: code, err: safeErrorMessage(cause) });
    return back(`error=${code}`);
  }
}
