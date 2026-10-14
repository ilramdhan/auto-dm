import "server-only";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaigns, deliveries, rules, type Delivery } from "@/server/db/schema";
import { ACTIVITY_PAGE_SIZE, type ActivityFilters } from "@/lib/validation/activity";

export type DeliveryRow = Delivery & { campaignName: string | null; ruleName: string | null };

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function whereFor(f: ActivityFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (f.status) parts.push(eq(deliveries.status, f.status));
  if (f.campaign) parts.push(eq(deliveries.campaignId, f.campaign));
  if (f.q) {
    const pattern = `%${escapeLike(f.q)}%`;
    const search = or(
      ilike(deliveries.commenterUsername, pattern),
      ilike(deliveries.commentText, pattern),
      ilike(deliveries.matchedKeyword, pattern),
    );
    if (search) parts.push(search);
  }
  return parts.length ? and(...parts) : undefined;
}

const selection = {
  delivery: deliveries,
  campaignName: campaigns.name,
  ruleName: rules.name,
};

export async function listDeliveries(
  f: ActivityFilters,
  pageSize = ACTIVITY_PAGE_SIZE,
): Promise<{ items: DeliveryRow[]; total: number }> {
  const where = whereFor(f);
  const [rows, [totalRow]] = await Promise.all([
    db
      .select(selection)
      .from(deliveries)
      .leftJoin(campaigns, eq(campaigns.id, deliveries.campaignId))
      .leftJoin(rules, eq(rules.id, deliveries.ruleId))
      .where(where)
      .orderBy(desc(deliveries.createdAt), desc(deliveries.id))
      .limit(pageSize)
      .offset((f.page - 1) * pageSize),
    db.select({ n: count() }).from(deliveries).where(where),
  ]);
  return {
    items: rows.map((r) => ({ ...r.delivery, campaignName: r.campaignName, ruleName: r.ruleName })),
    total: totalRow?.n ?? 0,
  };
}

export async function recentDeliveries(limit = 8): Promise<DeliveryRow[]> {
  const rows = await db
    .select(selection)
    .from(deliveries)
    .leftJoin(campaigns, eq(campaigns.id, deliveries.campaignId))
    .leftJoin(rules, eq(rules.id, deliveries.ruleId))
    .orderBy(desc(deliveries.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.delivery, campaignName: r.campaignName, ruleName: r.ruleName }));
}

export async function hasAnyDelivery(): Promise<boolean> {
  const [row] = await db.select({ id: deliveries.id }).from(deliveries).limit(1);
  return !!row;
}
