import "server-only";
import { and, count, desc, eq, ilike, isNull, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db, retryable } from "@/server/db/client";
import { campaigns, deliveries, rules, type Delivery } from "@/server/db/schema";
import { ACTIVITY_PAGE_SIZE, type ActivityFilters } from "@/lib/validation/activity";
import {
  ALL_REASONS,
  HIDDEN_SKIP_REASONS,
  SKIPPED_PAGE_SIZE,
  type SkippedFilters,
} from "@/lib/validation/skipped";
import { COMMENT_MAX_CHARS } from "@/server/instagram/constants";

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

async function listDeliveriesQuery(
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
export const listDeliveries = retryable("deliveries.listDeliveries", listDeliveriesQuery);

async function recentDeliveriesQuery(limit = 8): Promise<DeliveryRow[]> {
  const rows = await db
    .select(selection)
    .from(deliveries)
    .leftJoin(campaigns, eq(campaigns.id, deliveries.campaignId))
    .leftJoin(rules, eq(rules.id, deliveries.ruleId))
    .orderBy(desc(deliveries.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.delivery, campaignName: r.campaignName, ruleName: r.ruleName }));
}
export const recentDeliveries = retryable("deliveries.recentDeliveries", recentDeliveriesQuery);

async function hasAnyDeliveryQuery(): Promise<boolean> {
  const [row] = await db.select({ id: deliveries.id }).from(deliveries).limit(1);
  return !!row;
}
export const hasAnyDelivery = retryable("deliveries.hasAnyDelivery", hasAnyDeliveryQuery);

/* ---------------------------- skipped comments ---------------------------- */

export type SkippedRow = DeliveryRow & {
  /** Permalink of the post, when a campaign targets it and stored one. */
  mediaPermalink: string | null;
};

function skippedWhere(f: SkippedFilters): SQL | undefined {
  const parts: SQL[] = [eq(deliveries.status, "skipped")];
  if (f.reason && f.reason !== ALL_REASONS) parts.push(eq(deliveries.skipReason, f.reason));
  else if (!f.reason) {
    const visible = or(
      isNull(deliveries.skipReason),
      notInArray(deliveries.skipReason, [...HIDDEN_SKIP_REASONS]),
    );
    if (visible) parts.push(visible);
  }
  return and(...parts);
}

async function listSkippedDeliveriesQuery(
  f: SkippedFilters,
  pageSize = SKIPPED_PAGE_SIZE,
): Promise<{ items: SkippedRow[]; total: number }> {
  const where = skippedWhere(f);
  const permalink = sql<string | null>`(
    select ${campaigns.mediaPermalink} from ${campaigns}
    where ${campaigns.mediaId} = ${deliveries.mediaId} and ${campaigns.mediaPermalink} is not null
    order by ${campaigns.createdAt} limit 1
  )`;
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({ ...selection, mediaPermalink: permalink })
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
    items: rows.map((r) => ({
      ...r.delivery,
      campaignName: r.campaignName,
      ruleName: r.ruleName,
      mediaPermalink: r.mediaPermalink,
    })),
    total: totalRow?.n ?? 0,
  };
}
export const listSkippedDeliveries = retryable(
  "deliveries.listSkippedDeliveries",
  listSkippedDeliveriesQuery,
);

async function getDeliveryQuery(id: string): Promise<Delivery | undefined> {
  const [row] = await db.select().from(deliveries).where(eq(deliveries.id, id)).limit(1);
  return row;
}
export const getDelivery = retryable("deliveries.getDelivery", getDeliveryQuery);

/**
 * Atomically claims a skipped delivery for a manual send: `skipped` → `processing` (source
 * `manual`) only if it is still `skipped`. Returns `false` when another request got there first or
 * the row was already handled, which guarantees at most one Private Reply per comment.
 */
export async function claimSkippedDelivery(id: string): Promise<boolean> {
  const rows = await db
    .update(deliveries)
    .set({ status: "processing", source: "manual" })
    .where(and(eq(deliveries.id, id), eq(deliveries.status, "skipped")))
    .returning({ id: deliveries.id });
  return rows.length === 1;
}

/** Puts a claimed delivery back to `skipped` (e.g. when the manual send could not start). */
export async function restoreSkippedDelivery(id: string, reason: string | null): Promise<void> {
  await db
    .update(deliveries)
    .set({ status: "skipped", skipReason: reason })
    .where(and(eq(deliveries.id, id), eq(deliveries.status, "processing")));
}

export interface MissedCommentInput {
  commentId: string;
  mediaId: string;
  igUserId: string;
  commenterId: string;
  commenterUsername: string | null;
  text: string;
  createdAt: Date;
}

/**
 * Records comments found on Instagram that have no `deliveries` row as `skipped` /
 * `not_delivered` (source `manual`). Existing rows are left untouched (`ON CONFLICT (comment_id)
 * DO NOTHING`). `created_at` is the comment's own time so the 7-day window check stays correct.
 * Returns how many rows were added.
 */
export async function insertMissedComments(items: readonly MissedCommentInput[]): Promise<number> {
  if (items.length === 0) return 0;
  const now = new Date();
  const rows = await db
    .insert(deliveries)
    .values(
      items.map((c) => ({
        commentId: c.commentId,
        mediaId: c.mediaId,
        igUserId: c.igUserId,
        commenterId: c.commenterId,
        commenterUsername: c.commenterUsername,
        commentText: c.text.slice(0, COMMENT_MAX_CHARS),
        status: "skipped" as const,
        skipReason: "not_delivered",
        source: "manual" as const,
        createdAt: c.createdAt,
        processedAt: now,
      })),
    )
    .onConflictDoNothing({ target: deliveries.commentId })
    .returning({ id: deliveries.id });
  return rows.length;
}
