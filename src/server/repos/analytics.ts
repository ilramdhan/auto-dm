import "server-only";
import { and, eq, gte, isNull, lt, sql, type SQL } from "drizzle-orm";
import { db, retryable } from "@/server/db/client";
import { campaigns, deliveries, rules } from "@/server/db/schema";
import { addDaysYmd } from "@/lib/timezone";
import type { ResolvedRange } from "@/lib/validation/analytics";
import type { DeliveryStatusValue } from "@/lib/validation/activity";

/**
 * All aggregation happens in Postgres (`count(*) filter (where …)`, `date_trunc`), scoped by the
 * indexed `created_at` / `(campaign_id, created_at)` columns. Calendar days use the configured time zone.
 */
export type AnalyticsScope = {
  range: Pick<ResolvedRange, "from" | "to" | "days" | "fromYmd" | "timeZone">;
  campaignId?: string;
};

function scopeWhere({ range, campaignId }: AnalyticsScope): SQL {
  const parts = [gte(deliveries.createdAt, range.from), lt(deliveries.createdAt, range.to)];
  if (campaignId) parts.push(eq(deliveries.campaignId, campaignId));
  return and(...parts)!;
}

/* Reusable aggregate expressions. */
const d = deliveries;
const agg = {
  comments: sql<number>`count(${d.id})::int`,
  matched: sql<number>`count(${d.id}) filter (where ${d.ruleId} is not null or ${d.matchedKeyword} is not null)::int`,
  repliesSent: sql<number>`count(${d.id}) filter (where ${d.publicReplyStatus} = 'sent')::int`,
  repliesFailed: sql<number>`count(${d.id}) filter (where ${d.publicReplyStatus} = 'failed')::int`,
  dmsSent: sql<number>`count(${d.id}) filter (where ${d.dmStatus} = 'sent')::int`,
  dmsFailed: sql<number>`count(${d.id}) filter (where ${d.dmStatus} = 'failed')::int`,
  delivered: sql<number>`count(${d.id}) filter (where ${d.status} = 'sent')::int`,
  partial: sql<number>`count(${d.id}) filter (where ${d.status} = 'partial')::int`,
  failed: sql<number>`count(${d.id}) filter (where ${d.status} = 'failed')::int`,
  skipped: sql<number>`count(${d.id}) filter (where ${d.status} = 'skipped')::int`,
  lastActivity: sql<Date | null>`max(${d.createdAt})`,
};

export type Kpis = {
  comments: number;
  matched: number;
  repliesSent: number;
  repliesFailed: number;
  dmsSent: number;
  dmsFailed: number;
  delivered: number;
  partial: number;
  failed: number;
  skipped: number;
  avgDurationMs: number | null;
};

async function getKpisQuery(scope: AnalyticsScope): Promise<Kpis> {
  const [row] = await db
    .select({
      comments: agg.comments,
      matched: agg.matched,
      repliesSent: agg.repliesSent,
      repliesFailed: agg.repliesFailed,
      dmsSent: agg.dmsSent,
      dmsFailed: agg.dmsFailed,
      delivered: agg.delivered,
      partial: agg.partial,
      failed: agg.failed,
      skipped: agg.skipped,
      avgDurationMs: sql<number | null>`round(avg(${d.durationMs}))::int`,
    })
    .from(d)
    .where(scopeWhere(scope));
  return (
    row ?? {
      comments: 0,
      matched: 0,
      repliesSent: 0,
      repliesFailed: 0,
      dmsSent: 0,
      dmsFailed: 0,
      delivered: 0,
      partial: 0,
      failed: 0,
      skipped: 0,
      avgDurationMs: null,
    }
  );
}
export const getKpis = retryable("analytics.getKpis", getKpisQuery);

export type DayPoint = { day: string; comments: number; dmsSent: number; repliesSent: number };

/** One point per calendar day in the range's time zone (gaps filled with zeros). */
async function getDailySeriesQuery(scope: AnalyticsScope): Promise<DayPoint[]> {
  const dayExpr = sql<string>`to_char(${d.createdAt} at time zone ${scope.range.timeZone}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day: dayExpr, comments: agg.comments, dmsSent: agg.dmsSent, repliesSent: agg.repliesSent })
    .from(d)
    .where(scopeWhere(scope))
    // By position: a second `at time zone $n` parameter would not match the SELECT expression.
    .groupBy(sql`1`);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: DayPoint[] = [];
  for (let i = 0; i < scope.range.days; i++) {
    const day = addDaysYmd(scope.range.fromYmd, i);
    const r = byDay.get(day);
    out.push({ day, comments: r?.comments ?? 0, dmsSent: r?.dmsSent ?? 0, repliesSent: r?.repliesSent ?? 0 });
  }
  return out;
}
export const getDailySeries = retryable("analytics.getDailySeries", getDailySeriesQuery);

async function getStatusBreakdownQuery(
  scope: AnalyticsScope,
): Promise<{ status: DeliveryStatusValue; count: number }[]> {
  return db
    .select({ status: d.status, count: sql<number>`count(*)::int` })
    .from(d)
    .where(scopeWhere(scope))
    .groupBy(d.status)
    .orderBy(sql`count(*) desc`);
}
export const getStatusBreakdown = retryable("analytics.getStatusBreakdown", getStatusBreakdownQuery);

export type ContentRow = {
  key: string;
  campaignId: string | null;
  name: string;
  mediaId: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  allPosts: boolean;
  comments: number;
  matched: number;
  repliesSent: number;
  repliesFailed: number;
  dmsSent: number;
  dmsFailed: number;
  delivered: number;
  lastActivity: Date | null;
};

/** One row per campaign (every campaign is listed, even with zero comments) + an "unassigned" row. */
async function getPerCampaignQuery(scope: AnalyticsScope): Promise<ContentRow[]> {
  const joinOn = and(
    eq(d.campaignId, campaigns.id),
    gte(d.createdAt, scope.range.from),
    lt(d.createdAt, scope.range.to),
  );
  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      mediaId: campaigns.mediaId,
      thumbnailUrl: campaigns.mediaThumbnailUrl,
      permalink: campaigns.mediaPermalink,
      comments: agg.comments,
      matched: agg.matched,
      repliesSent: agg.repliesSent,
      repliesFailed: agg.repliesFailed,
      dmsSent: agg.dmsSent,
      dmsFailed: agg.dmsFailed,
      delivered: agg.delivered,
      lastActivity: agg.lastActivity,
    })
    .from(campaigns)
    .leftJoin(d, joinOn)
    .where(scope.campaignId ? eq(campaigns.id, scope.campaignId) : undefined)
    .groupBy(campaigns.id)
    .orderBy(sql`count(${d.id}) desc`, campaigns.name);

  const out: ContentRow[] = rows.map((r) => ({
    key: r.id,
    campaignId: r.id,
    name: r.name,
    mediaId: r.mediaId,
    thumbnailUrl: r.thumbnailUrl,
    permalink: r.permalink,
    allPosts: !r.mediaId,
    comments: r.comments,
    matched: r.matched,
    repliesSent: r.repliesSent,
    repliesFailed: r.repliesFailed,
    dmsSent: r.dmsSent,
    dmsFailed: r.dmsFailed,
    delivered: r.delivered,
    lastActivity: r.lastActivity ? new Date(r.lastActivity) : null,
  }));

  if (!scope.campaignId) {
    const [u] = await db
      .select({
        comments: agg.comments,
        lastActivity: agg.lastActivity,
      })
      .from(d)
      .where(and(scopeWhere(scope), isNull(d.campaignId)));
    if (u && u.comments > 0) {
      out.push({
        key: "unassigned",
        campaignId: null,
        name: "No matching campaign",
        mediaId: null,
        thumbnailUrl: null,
        permalink: null,
        allPosts: false,
        comments: u.comments,
        matched: 0,
        repliesSent: 0,
        repliesFailed: 0,
        dmsSent: 0,
        dmsFailed: 0,
        delivered: 0,
        lastActivity: u.lastActivity ? new Date(u.lastActivity) : null,
      });
    }
  }
  return out;
}
export const getPerCampaign = retryable("analytics.getPerCampaign", getPerCampaignQuery);

/** One row per Instagram post/reel that received comments (thumbnail from a campaign targeting it). */
async function getPerPostQuery(scope: AnalyticsScope, limit = 200): Promise<ContentRow[]> {
  const meta = sql<{ id: string; name: string; thumb: string | null; link: string | null } | null>`(
    select json_build_object('id', c.id, 'name', c.name, 'thumb', c.media_thumbnail_url, 'link', c.media_permalink)
    from ${campaigns} c where c.media_id = ${d.mediaId} order by c.created_at desc limit 1)`;
  const rows = await db
    .select({
      mediaId: d.mediaId,
      meta,
      comments: agg.comments,
      matched: agg.matched,
      repliesSent: agg.repliesSent,
      repliesFailed: agg.repliesFailed,
      dmsSent: agg.dmsSent,
      dmsFailed: agg.dmsFailed,
      delivered: agg.delivered,
      lastActivity: agg.lastActivity,
    })
    .from(d)
    .where(scopeWhere(scope))
    .groupBy(d.mediaId)
    .orderBy(sql`count(${d.id}) desc`)
    .limit(limit);
  return rows.map((r) => ({
    key: r.mediaId ?? "unknown",
    campaignId: r.meta?.id ?? null,
    name: r.meta?.name ?? (r.mediaId ? `Post ${r.mediaId}` : "Unknown post"),
    mediaId: r.mediaId,
    thumbnailUrl: r.meta?.thumb ?? null,
    permalink: r.meta?.link ?? null,
    allPosts: false,
    comments: r.comments,
    matched: r.matched,
    repliesSent: r.repliesSent,
    repliesFailed: r.repliesFailed,
    dmsSent: r.dmsSent,
    dmsFailed: r.dmsFailed,
    delivered: r.delivered,
    lastActivity: r.lastActivity ? new Date(r.lastActivity) : null,
  }));
}
export const getPerPost = retryable("analytics.getPerPost", getPerPostQuery);

export type KeywordRow = {
  ruleId: string | null;
  ruleName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  keyword: string;
  matches: number;
  repliesSent: number;
  dmsSent: number;
  dmsFailed: number;
};

async function getKeywordBreakdownQuery(scope: AnalyticsScope, limit = 50): Promise<KeywordRow[]> {
  return db
    .select({
      ruleId: d.ruleId,
      ruleName: rules.name,
      campaignId: d.campaignId,
      campaignName: campaigns.name,
      keyword: sql<string>`${d.matchedKeyword}`,
      matches: agg.comments,
      repliesSent: agg.repliesSent,
      dmsSent: agg.dmsSent,
      dmsFailed: agg.dmsFailed,
    })
    .from(d)
    .leftJoin(rules, eq(rules.id, d.ruleId))
    .leftJoin(campaigns, eq(campaigns.id, d.campaignId))
    .where(and(scopeWhere(scope), sql`${d.matchedKeyword} is not null`))
    .groupBy(d.ruleId, rules.name, d.campaignId, campaigns.name, d.matchedKeyword)
    .orderBy(sql`count(${d.id}) desc`)
    .limit(limit);
}
export const getKeywordBreakdown = retryable("analytics.getKeywordBreakdown", getKeywordBreakdownQuery);

async function getTopSkipReasonsQuery(
  scope: AnalyticsScope,
  limit = 8,
): Promise<{ reason: string; count: number }[]> {
  return db
    .select({ reason: sql<string>`coalesce(${d.skipReason}, 'unknown')`, count: sql<number>`count(*)::int` })
    .from(d)
    .where(and(scopeWhere(scope), eq(d.status, "skipped")))
    .groupBy(sql`1`)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
}
export const getTopSkipReasons = retryable("analytics.getTopSkipReasons", getTopSkipReasonsQuery);

async function getTopErrorsQuery(
  scope: AnalyticsScope,
  limit = 8,
): Promise<{ code: string; count: number; sample: string | null; last: Date | null }[]> {
  const rows = await db
    .select({
      code: sql<string>`coalesce(${d.errorCode}, 'unknown')`,
      count: sql<number>`count(*)::int`,
      sample: sql<
        string | null
      >`(array_agg(${d.error} order by ${d.createdAt} desc) filter (where ${d.error} is not null))[1]`,
      last: sql<Date | null>`max(${d.createdAt})`,
    })
    .from(d)
    .where(and(scopeWhere(scope), sql`(${d.errorCode} is not null or ${d.status} in ('failed', 'partial'))`))
    .groupBy(sql`1`)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
  return rows.map((r) => ({ ...r, last: r.last ? new Date(r.last) : null }));
}
export const getTopErrors = retryable("analytics.getTopErrors", getTopErrorsQuery);
