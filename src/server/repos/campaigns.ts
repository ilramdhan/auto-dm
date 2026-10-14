import "server-only";
import { asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaigns, rules, type Campaign } from "@/server/db/schema";
import type { CampaignData } from "@/lib/validation/campaign";

export type CampaignListItem = Campaign & {
  ruleCount: number;
  activeRuleCount: number;
  keywordCount: number;
};

export async function listCampaigns(): Promise<CampaignListItem[]> {
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

export async function listCampaignOptions(): Promise<{ id: string; name: string }[]> {
  return db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns).orderBy(asc(campaigns.name));
}

export async function countCampaigns(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(campaigns);
  return row?.n ?? 0;
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row;
}

function toColumns(data: CampaignData) {
  const media = data.target === "media";
  return {
    name: data.name,
    description: data.description || null,
    mediaId: media ? (data.mediaId ?? null) : null,
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
