import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";
import { safeEqual } from "@/server/crypto";
import { AppError } from "@/server/errors";
import { getActiveAccount, refreshTokenIfNeeded } from "@/server/instagram/account";
import { errorResponse, noStore } from "@/server/instagram/http";
import { getRequestId, logger } from "@/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rootLog = logger("cron");

/**
 * Daily long-lived token refresh (Vercel Cron).
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when the `CRON_SECRET` env var is
 * set (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs). Headers such as
 * `x-vercel-cron` / the `vercel-cron` user agent can be spoofed, so they are NOT trusted. Without
 * `CRON_SECRET` the route is refused in production (412) and open only in development/test.
 */
export async function GET(req: NextRequest) {
  const started = Date.now();
  const log = rootLog.child({ requestId: getRequestId(req.headers) });
  try {
    const { CRON_SECRET, NODE_ENV } = env();
    if (CRON_SECRET) {
      if (!safeEqual(req.headers.get("authorization") ?? "", `Bearer ${CRON_SECRET}`)) {
        throw new AppError("UNAUTHORIZED", "Invalid cron secret");
      }
    } else if (NODE_ENV === "production") {
      throw new AppError("NOT_CONFIGURED", "Set CRON_SECRET to enable the token refresh cron");
    }

    const account = await getActiveAccount();
    if (!account || !account.accessTokenEnc) {
      log.info("cron.token_refresh", { refreshed: false, reason: "no_account" });
      return NextResponse.json({ refreshed: false, reason: "no_account" }, { headers: noStore() });
    }
    const { refreshed, expiresAt } = await refreshTokenIfNeeded(account);
    log.info("cron.token_refresh", {
      refreshed,
      expiresAt: expiresAt?.toISOString() ?? null,
      durationMs: Date.now() - started,
    });
    return NextResponse.json(
      { refreshed, expiresAt: expiresAt?.toISOString() ?? null },
      { headers: noStore() },
    );
  } catch (err) {
    return errorResponse(err, log, "cron.token_refresh_failed");
  }
}
