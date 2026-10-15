import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";
import { safeEqual } from "@/server/crypto";
import { AppError } from "@/server/errors";
import { getActiveAccount, refreshTokenIfNeeded } from "@/server/instagram/account";
import { errorResponse, noStore } from "@/server/instagram/http";
import { getRequestId, logger } from "@/server/log";
import { purgeOldDeliveries } from "@/server/repos/retention";
import { getSetting } from "@/server/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rootLog = logger("cron");

/** Deletes comment records past the configured retention. Never throws: a purge failure must not fail the token refresh. */
async function purgeExpired(log: ReturnType<typeof logger>): Promise<number | null> {
  try {
    const days = (await getSetting("processing.retentionDays")) ?? 365;
    const purged = await purgeOldDeliveries(days, new Date());
    log.info("cron.retention_purge", { retentionDays: days, purged });
    return purged;
  } catch (err) {
    log.warn("cron.retention_purge_failed", { err: err instanceof Error ? err.name : "unknown" });
    return null;
  }
}

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
      const purged = await purgeExpired(log);
      return NextResponse.json({ refreshed: false, reason: "no_account", purged }, { headers: noStore() });
    }
    let refreshResult: Awaited<ReturnType<typeof refreshTokenIfNeeded>>;
    try {
      refreshResult = await refreshTokenIfNeeded(account);
    } catch (err) {
      // Still run the purge, then surface the refresh failure.
      await purgeExpired(log);
      throw err;
    }
    const { refreshed, expiresAt } = refreshResult;
    log.info("cron.token_refresh", {
      refreshed,
      expiresAt: expiresAt?.toISOString() ?? null,
      durationMs: Date.now() - started,
    });
    const purged = await purgeExpired(log);
    return NextResponse.json(
      { refreshed, expiresAt: expiresAt?.toISOString() ?? null, purged },
      { headers: noStore() },
    );
  } catch (err) {
    return errorResponse(err, log, "cron.token_refresh_failed");
  }
}
