import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";
import { safeEqual } from "@/server/crypto";
import { getActiveAccount, refreshTokenIfNeeded } from "@/server/instagram/account";
import { safeErrorMessage } from "@/server/instagram/graph";
import { noStore } from "@/server/instagram/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily long-lived token refresh (Vercel Cron).
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when the `CRON_SECRET` env var is
 * set (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs). Headers such as
 * `x-vercel-cron` / the `vercel-cron` user agent can be spoofed, so they are NOT trusted. Without
 * `CRON_SECRET` the route is refused in production and open only in development/test.
 */
export async function GET(req: NextRequest) {
  const { CRON_SECRET, NODE_ENV } = env();
  if (CRON_SECRET) {
    const header = req.headers.get("authorization") ?? "";
    if (!safeEqual(header, `Bearer ${CRON_SECRET}`)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore() });
    }
  } else if (NODE_ENV === "production") {
    return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 503, headers: noStore() });
  }

  const account = await getActiveAccount();
  if (!account || !account.accessTokenEnc) {
    return NextResponse.json({ refreshed: false, reason: "no_account" }, { headers: noStore() });
  }
  try {
    const { refreshed, expiresAt } = await refreshTokenIfNeeded(account);
    return NextResponse.json({ refreshed, expiresAt: expiresAt?.toISOString() ?? null }, { headers: noStore() });
  } catch (err) {
    console.error("[cron] token refresh failed:", safeErrorMessage(err));
    return NextResponse.json(
      { refreshed: false, error: "refresh_failed", message: safeErrorMessage(err) },
      { status: 502, headers: noStore() },
    );
  }
}
