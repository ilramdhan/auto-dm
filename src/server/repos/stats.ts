import "server-only";
import { gte, sql } from "drizzle-orm";
import { db, retryable } from "@/server/db/client";
import { deliveries } from "@/server/db/schema";
import { DEFAULT_TIME_ZONE, ymdInZone, zonedMidnight } from "@/lib/timezone";

export type DashboardStats = {
  /** Since 00:00 today in the configured time zone. */
  commentsToday: number;
  comments7d: number;
  dmsSent7d: number;
  replies7d: number;
  failed7d: number;
  skipped7d: number;
};

async function getDashboardStatsQuery(
  now = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<DashboardStats> {
  const day = zonedMidnight(ymdInZone(now, timeZone), timeZone);
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({
      commentsToday: sql<number>`count(*) filter (where ${deliveries.createdAt} >= ${day.toISOString()})::int`,
      comments7d: sql<number>`count(*)::int`,
      dmsSent7d: sql<number>`count(*) filter (where ${deliveries.dmStatus} = 'sent')::int`,
      replies7d: sql<number>`count(*) filter (where ${deliveries.publicReplyStatus} = 'sent')::int`,
      failed7d: sql<number>`count(*) filter (where ${deliveries.status} in ('failed', 'partial'))::int`,
      skipped7d: sql<number>`count(*) filter (where ${deliveries.status} = 'skipped')::int`,
    })
    .from(deliveries)
    .where(gte(deliveries.createdAt, week));
  return row ?? { commentsToday: 0, comments7d: 0, dmsSent7d: 0, replies7d: 0, failed7d: 0, skipped7d: 0 };
}
export const getDashboardStats = retryable("stats.getDashboardStats", getDashboardStatsQuery);
