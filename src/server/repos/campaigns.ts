import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db, retryable } from "@/server/db/client";
import { campaigns, rules, type Campaign } from "@/server/db/schema";
import { MAX_CAMPAIGN_MEDIA, type CampaignData } from "@/lib/validation/campaign";

export type CampaignListItem = Campaign & {
  ruleCount: number;
  activeRuleCount: number;
  keywordCount: number;
};

async function listCampaignsQuery(): Promise<CampaignListItem[]> {
  const rows = await db
    .select({
      campaign: campaigns,
      ruleCount: sql<number>`count(${rules.id})::int`,
      activeRuleCount: sql<number>`count(${rules.id}) filter (where ${rules.isActive})::int`,
      keywordCount: sql<number>`coalesce(sum(cardinality(${rules.keywords})), 0)::int`,
    })
    .from(campaigns)
    .leftJoin(rules, eq(rules.campaignId, campaigns.id))
    .groupBy(campaigns.id)
    .orderBy(desc(campaigns.createdAt));
  return rows.map((r) => ({
    ...r.campaign,
    ruleCount: r.ruleCount,
    activeRuleCount: r.activeRuleCount,
    keywordCount: r.keywordCount,
  }));
}
export const listCampaigns = retryable("campaigns.listCampaigns", listCampaignsQuery);

async function listCampaignOptionsQuery(): Promise<{ id: string; name: string }[]> {
  return db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns).orderBy(asc(campaigns.name));
}
export const listCampaignOptions = retryable("campaigns.listCampaignOptions", listCampaignOptionsQuery);

async function countCampaignsQuery(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(campaigns);
  return row?.n ?? 0;
}
export const countCampaigns = retryable("campaigns.countCampaigns", countCampaignsQuery);

async function getCampaignQuery(id: string): Promise<Campaign | undefined> {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row;
}
export const getCampaign = retryable("campaigns.getCampaign", getCampaignQuery);

/**
 * Form data -> columns. `media_ids` is the source of truth; `media_id` mirrors its first element
 * (legacy readers: n8n workflows, older code, external SQL). "All posts" writes NULL to both.
 */
function toColumns(data: CampaignData) {
  const media = data.target === "media" && data.mediaIds.length > 0;
  return {
    name: data.name,
    description: data.description || null,
    mediaIds: media ? data.mediaIds : null,
    mediaId: media ? (data.mediaIds[0] ?? null) : null,
    mediaPermalink: media ? data.mediaPermalink || null : null,
    mediaThumbnailUrl: media ? data.mediaThumbnailUrl || null : null,
    mediaCaption: media ? (data.mediaCaption ?? null) : null,
    isActive: data.isActive,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
  };
}

export async function createCampaign(data: CampaignData, accountId: string | null): Promise<Campaign> {
  const [row] = await db
    .insert(campaigns)
    .values({ ...toColumns(data), accountId })
    .returning();
  if (!row) throw new Error("Insert failed");
  return row;
}

export async function updateCampaign(id: string, data: CampaignData): Promise<Campaign | undefined> {
  const [row] = await db.update(campaigns).set(toColumns(data)).where(eq(campaigns.id, id)).returning();
  return row;
}

export async function setCampaignActive(id: string, isActive: boolean): Promise<boolean> {
  const rows = await db
    .update(campaigns)
    .set({ isActive })
    .where(eq(campaigns.id, id))
    .returning({ id: campaigns.id });
  return rows.length > 0;
}

export async function deleteCampaign(id: string): Promise<boolean> {
  const rows = await db.delete(campaigns).where(eq(campaigns.id, id)).returning({ id: campaigns.id });
  return rows.length > 0;
}

export type AddMediaResult = "added" | "already" | "not_found" | "all_posts" | "full";

/**
 * Appends `mediaId` to a post-specific campaign's `media_ids` ("Add this post to campaign").
 * Idempotent: a single UPDATE that only appends when the id is absent, so concurrent clicks can't
 * add it twice. Rows not yet backfilled (`media_ids` NULL) start from `[media_id]`. `media_id`
 * keeps mirroring the first element. "All posts" campaigns are refused (they already cover it).
 */
export async function addMediaToCampaign(campaignId: string, mediaId: string): Promise<AddMediaResult> {
  const current = sql`coalesce(nullif(${campaigns.mediaIds}, '{}'::text[]), array_remove(array[${campaigns.mediaId}], null))`;
  const rows = await db
    .update(campaigns)
    .set({
      mediaIds: sql`array_append(${current}, ${mediaId}::text)`,
      // Appending never changes the first element, so the mirror stays `media_ids[1]`.
      mediaId: sql`(${current})[1]`,
    })
    .where(
      and(
        eq(campaigns.id, campaignId),
        sql`cardinality(${current}) > 0`,
        sql`cardinality(${current}) < ${MAX_CAMPAIGN_MEDIA}`,
        sql`not (${current} @> array[${mediaId}::text])`,
      ),
    )
    .returning({ id: campaigns.id });
  if (rows.length > 0) return "added";

  // Nothing updated: find out why (for the message shown to the operator).
  const row = await getCampaignQuery(campaignId);
  if (!row) return "not_found";
  const ids = row.mediaIds?.length ? row.mediaIds : row.mediaId ? [row.mediaId] : [];
  if (ids.length === 0) return "all_posts";
  if (ids.includes(mediaId)) return "already";
  return "full";
}
