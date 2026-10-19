import "server-only";
import { and, asc, eq, gt, inArray, isNotNull, isNull, lte, ne, or, type SQL } from "drizzle-orm";
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

/**
 * Loads active campaigns (with their active rules) that apply to a comment on `mediaId` for
 * `accountId`: campaign is active, targets this media or all posts (`media_id IS NULL`), belongs
 * to this account or to none, and `now` is inside `[startsAt, endsAt)`.
 * Media-specific campaigns come first, then "all posts" campaigns (oldest first within a tier).
 */
export async function loadApplicableCampaigns(params: {
  accountId: string;
  mediaId: string | null;
  now?: Date;
}): Promise<CampaignWithRules[]> {
  const now = params.now ?? new Date();
  const mediaCond = params.mediaId
    ? or(eq(campaigns.mediaId, params.mediaId), isNull(campaigns.mediaId))
    : isNull(campaigns.mediaId);
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
 * Active, in-schedule post-specific campaigns of the account for posts other than `mediaId`, with
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
        isNotNull(campaigns.mediaId),
        params.mediaId ? ne(campaigns.mediaId, params.mediaId) : undefined,
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
