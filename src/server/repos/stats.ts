import "server-only";
import { gte, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { deliveries } from "@/server/db/schema";

export type DashboardStats = {
  comments24h: number;
  comments7d: number;
  dmsSent7d: number;
  replies7d: number;
  failed7d: number;
  skipped7d: number;
};

export async function getDashboardStats(now = new Date()): Promise<DashboardStats> {
  const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({
      comments24h: sql<number>`count(*) filter (where ${deliveries.createdAt} >= ${day.toISOString()})::int`,
      comments7d: sql<number>`count(*)::int`,
      dmsSent7d: sql<number>`count(*) filter (where ${deliveries.dmStatus} = 'sent')::int`,
      replies7d: sql<number>`count(*) filter (where ${deliveries.publicReplyStatus} = 'sent')::int`,
      failed7d: sql<number>`count(*) filter (where ${deliveries.status} in ('failed', 'partial'))::int`,
      skipped7d: sql<number>`count(*) filter (where ${deliveries.status} = 'skipped')::int`,
    })
    .from(deliveries)
    .where(gte(deliveries.createdAt, week));
  return row ?? { comments24h: 0, comments7d: 0, dmsSent7d: 0, replies7d: 0, failed7d: 0, skipped7d: 0 };
}
