import "server-only";
import { and, asc, eq, gt, inArray, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaigns, rules } from "@/server/db/schema";
import {
  campaignsForMedia,
  pickMatch,
  pickOtherPostMatch,
  type CampaignWithRules,
  type ResolvedMatch,
} from "./pick";

export type { CampaignWithRules, ResolvedMatch };

/*
 * Targeting in SQL, mirroring `campaignMediaIds()` in pick.ts: `media_ids` is the source of truth;
 * rows with an empty/NULL `media_ids` fall back to the legacy `media_id`.
 */
const noMediaIds = sql`(${campaigns.mediaIds} is null or cardinality(${campaigns.mediaIds}) = 0)`;

/** "All posts" campaigns: no media ids at all. */
export const allPostsCond: SQL = sql`(${noMediaIds} and ${campaigns.mediaId} is null)`;

/** Post-specific campaigns (target at least one media id). */
export const postSpecificCond: SQL = sql`not ${allPostsCond}`;

/** Campaigns that target `mediaId` (the `@>` can use the GIN index on `media_ids`). */
export function targetsMediaCond(mediaId: string): SQL {
  return sql`(${campaigns.mediaIds} @> array[${mediaId}]::text[] or (${noMediaIds} and ${campaigns.mediaId} = ${mediaId}))`;
}

/** Campaigns that don't target `mediaId` (NULL-safe negation of {@link targetsMediaCond}). */
export function notTargetsMediaCond(mediaId: string): SQL {
  return sql`not coalesce(${targetsMediaCond(mediaId)}, false)`;
}

/**
 * Loads active campaigns (with their active rules) that apply to a comment on `mediaId` for
 * `accountId`: campaign is active, targets this media (in `media_ids`, or legacy `media_id`) or all
 * posts (neither set), belongs
 * to this account or to none, and `now` is inside `[startsAt, endsAt)`.
 * Media-specific campaigns come first, then "all posts" campaigns (oldest first within a tier).
 */
export async function loadApplicableCampaigns(params: {
  accountId: string;
  mediaId: string | null;
  now?: Date;
}): Promise<CampaignWithRules[]> {
  const now = params.now ?? new Date();
  const mediaCond = params.mediaId ? or(targetsMediaCond(params.mediaId), allPostsCond) : allPostsCond;
  return loadCampaignsWithRules(and(activeCampaignCond(params.accountId, now), mediaCond));
}

/** Active, in-schedule campaigns of `accountId` (or of no account). */
function activeCampaignCond(accountId: string, now: Date): SQL | undefined {
  return and(
    eq(campaigns.isActive, true),
    or(eq(campaigns.accountId, accountId), isNull(campaigns.accountId)),
    or(isNull(campaigns.startsAt), lte(campaigns.startsAt, now)),
    or(isNull(campaigns.endsAt), gt(campaigns.endsAt, now)),
  );
}

async function loadCampaignsWithRules(where: SQL | undefined): Promise<CampaignWithRules[]> {
  const rows = await db.select().from(campaigns).where(where).orderBy(asc(campaigns.createdAt));
  if (rows.length === 0) return [];

  const ruleRows = await db
    .select()
    .from(rules)
    .where(
      and(
        inArray(
          rules.campaignId,
          rows.map((c) => c.id),
        ),
        eq(rules.isActive, true),
      ),
    )
    .orderBy(asc(rules.createdAt));

  return campaignsForMedia(
    rows.map((campaign) => ({ campaign, rules: ruleRows.filter((r) => r.campaignId === campaign.id) })),
    undefined,
  );
}

/**
 * Every active, in-schedule campaign (with active rules) for the account, post-specific first. Use
 * {@link campaignsForMedia} to narrow it to one post without another query (Skipped comments page).
 */
export async function loadActiveCampaigns(params: { accountId: string; now?: Date }) {
  return loadCampaignsWithRules(activeCampaignCond(params.accountId, params.now ?? new Date()));
}

/**
 * Active, in-schedule post-specific campaigns of the account that don't target `mediaId`, with
 * their active keyword rules (no `any` rules), in one query. Only used on the no-match path to
 * detect `no_campaign_for_post` (see {@link pickOtherPostMatch}).
 */
export async function loadOtherPostCampaigns(params: {
  accountId: string;
  mediaId: string | null;
  now?: Date;
}): Promise<CampaignWithRules[]> {
  const now = params.now ?? new Date();
  const rows = await db
    .select({ campaign: campaigns, rule: rules })
    .from(campaigns)
    .innerJoin(rules, eq(rules.campaignId, campaigns.id))
    .where(
      and(
        activeCampaignCond(params.accountId, now),
        postSpecificCond,
        params.mediaId ? notTargetsMediaCond(params.mediaId) : undefined,
        eq(rules.isActive, true),
        ne(rules.matchMode, "any"),
      ),
    )
    .orderBy(asc(campaigns.createdAt), asc(campaigns.id), asc(rules.createdAt));
  const byId = new Map<string, CampaignWithRules>();
  for (const { campaign, rule } of rows) {
    const entry = byId.get(campaign.id) ?? { campaign, rules: [] };
    entry.rules.push(rule);
    byId.set(campaign.id, entry);
  }
  return [...byId.values()];
}

/**
 * For a comment that matched nothing: the rule it would match on another post's campaign (see
 * {@link pickOtherPostMatch}), or `null`.
 */
export async function resolveOtherPostRule(params: {
  accountId: string;
  mediaId: string | null;
  text: string;
  isReply?: boolean;
  now?: Date;
}): Promise<ResolvedMatch | null> {
  const others = await loadOtherPostCampaigns(params);
  return pickOtherPostMatch(params.text, others, params.mediaId, { isReply: params.isReply });
}

/** Loads applicable campaigns and returns the matching rule for the comment, if any. */
export async function resolveRule(params: {
  accountId: string;
  mediaId: string | null;
  text: string;
  /** The comment is a reply in a thread (`parent_id` set); `any` rules skip these. */
  isReply?: boolean;
  now?: Date;
}): Promise<ResolvedMatch | null> {
  const applicable = await loadApplicableCampaigns(params);
  return pickMatch(params.text, applicable, { isReply: params.isReply });
}
