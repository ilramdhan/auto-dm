/** Campaign/rule selection. Pure and isomorphic (types only from the schema). */
import type { Campaign, Rule } from "@/server/db/schema";
import { matchComment, type MatchOptions } from "./match";

export interface CampaignWithRules {
  campaign: Campaign;
  rules: Rule[];
}

export interface ResolvedMatch {
  campaign: Campaign;
  rule: Rule;
  keyword: string;
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
    applicable.filter((c) => c.campaign.mediaId !== null),
    applicable.filter((c) => c.campaign.mediaId === null),
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
