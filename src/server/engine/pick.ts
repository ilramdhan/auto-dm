/** Campaign/rule selection. Pure and isomorphic (types only from the schema). */
import type { Campaign, Rule } from "@/server/db/schema";
import { matchComment, type MatchOptions } from "./match";

export interface CampaignWithRules {
  campaign: Campaign;
  rules: Rule[];
}

type CampaignTarget = Pick<Campaign, "mediaId" | "mediaIds">;

/**
 * The media ids a campaign targets: `mediaIds` (source of truth), falling back to the legacy
 * single `mediaId` for rows written before `media_ids` existed. Empty = "all posts". Pure.
 */
export function campaignMediaIds(c: CampaignTarget): string[] {
  if (c.mediaIds && c.mediaIds.length > 0) return c.mediaIds;
  return c.mediaId ? [c.mediaId] : [];
}

/** Does the campaign target specific posts (as opposed to "all posts")? Pure. */
export function isPostSpecific(c: CampaignTarget): boolean {
  return campaignMediaIds(c).length > 0;
}

/** Does a post-specific campaign target `mediaId`? ("All posts" campaigns return false.) Pure. */
export function targetsMedia(c: CampaignTarget, mediaId: string | null | undefined): boolean {
  return !!mediaId && campaignMediaIds(c).includes(mediaId);
}

export interface ResolvedMatch {
  campaign: Campaign;
  rule: Rule;
  keyword: string;
}

/**
 * Narrows campaigns to those that apply to a comment on `mediaId` (campaigns whose `mediaIds`
 * include it, plus
 * "all posts" campaigns; `null` = only "all posts"; `undefined` = no narrowing) and orders them
 * post-specific first, keeping input order within a tier. Pure.
 */
export function campaignsForMedia(
  all: readonly CampaignWithRules[],
  mediaId: string | null | undefined,
): CampaignWithRules[] {
  const applies = all.filter(
    (c) => mediaId === undefined || !isPostSpecific(c.campaign) || targetsMedia(c.campaign, mediaId),
  );
  return [
    ...applies.filter((c) => isPostSpecific(c.campaign)),
    ...applies.filter((c) => !isPostSpecific(c.campaign)),
  ];
}

/**
 * Picks the rule for a comment: media-specific campaigns are tried first (all their rules,
 * by priority); only if none match are "all posts" campaigns tried. Within a tier keyword rules beat
 * `any` rules (see `matchComment`), but tiers come first: a media-specific `any` rule beats an
 * "all posts" keyword rule. Pure.
 */
export function pickMatch(
  text: string,
  applicable: readonly CampaignWithRules[],
  opts: MatchOptions = {},
): ResolvedMatch | null {
  const tiers = [
    applicable.filter((c) => isPostSpecific(c.campaign)),
    applicable.filter((c) => !isPostSpecific(c.campaign)),
  ];
  for (const tier of tiers) {
    const candidates = tier.flatMap(({ campaign, rules: rs }) => rs.map((rule) => ({ ...rule, campaign })));
    const hit = matchComment(text, candidates, opts);
    if (hit) {
      const { campaign, ...rule } = hit.rule;
      return { campaign, rule, keyword: hit.keyword };
    }
  }
  return null;
}

/**
 * For a comment that matched nothing: would its text match a keyword rule of a post-specific
 * campaign for a *different* post? (Typical cause: the comment is on the ad version of a boosted
 * reel, whose media id differs from the organic reel the campaign targets.) `any` rules are ignored
 * here, otherwise every unmatched comment would be reported. Campaigns that target `mediaId` (in
 * any of their `mediaIds`) and
 * "all posts" campaigns are ignored (they were already tried). Same priority order as
 * {@link pickMatch}. Pure.
 */
export function pickOtherPostMatch(
  text: string,
  campaigns: readonly CampaignWithRules[],
  mediaId: string | null,
  opts: MatchOptions = {},
): ResolvedMatch | null {
  const candidates = campaigns
    .filter((c) => isPostSpecific(c.campaign) && !targetsMedia(c.campaign, mediaId))
    .flatMap(({ campaign, rules: rs }) =>
      rs.filter((r) => r.matchMode !== "any").map((rule) => ({ ...rule, campaign })),
    );
  const hit = matchComment(text, candidates, opts);
  if (!hit) return null;
  const { campaign, ...rule } = hit.rule;
  return { campaign, rule, keyword: hit.keyword };
}
