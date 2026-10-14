import "server-only";
import { and, asc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaigns, rules } from "@/server/db/schema";
import { pickMatch, type CampaignWithRules, type ResolvedMatch } from "./pick";

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

  const rows = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.isActive, true),
        or(eq(campaigns.accountId, params.accountId), isNull(campaigns.accountId)),
        mediaCond,
        or(isNull(campaigns.startsAt), lte(campaigns.startsAt, now)),
        or(isNull(campaigns.endsAt), gt(campaigns.endsAt, now)),
      ),
    )
    .orderBy(asc(campaigns.createdAt));
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

  const ordered = [...rows.filter((c) => c.mediaId !== null), ...rows.filter((c) => c.mediaId === null)];
  return ordered.map((campaign) => ({
    campaign,
    rules: ruleRows.filter((r) => r.campaignId === campaign.id),
  }));
}

/** Loads applicable campaigns and returns the matching rule for the comment, if any. */
export async function resolveRule(params: {
  accountId: string;
  mediaId: string | null;
  text: string;
  now?: Date;
}): Promise<ResolvedMatch | null> {
  const applicable = await loadApplicableCampaigns(params);
  return pickMatch(params.text, applicable);
}
