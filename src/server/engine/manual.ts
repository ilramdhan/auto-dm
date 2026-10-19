/**
 * Pure helpers for manual send from the Skipped comments page. Isomorphic (no DB, no
 * `server-only`), like `pick.ts`.
 */
import { ANY_KEYWORD, matchComment, templateKeyword } from "./match";
import { campaignsForMedia, pickMatch, type CampaignWithRules, type ResolvedMatch } from "./pick";
import { renderTemplate, truncateText } from "./template";
import type { Campaign, Delivery, Rule } from "@/server/db/schema";

/** Meta allows a Private Reply to a comment only within 7 days of it being posted. */
export const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Is a comment created at `createdAt` still inside the 7-day Private Reply window at `now`? */
export function isWithinPrivateReplyWindow(createdAt: Date, now: Date = new Date()): boolean {
  const age = now.getTime() - createdAt.getTime();
  return Number.isFinite(age) && age < PRIVATE_REPLY_WINDOW_MS;
}

/** Skip reasons that can never be sent manually (loop protection / another account's comment). */
export const UNSENDABLE_SKIP_REASONS: ReadonlySet<string> = new Set(["own_comment", "account_mismatch"]);

/** Why a row can't be sent manually right now (shown in the UI), or `null` when it can. Pure. */
export function manualSendBlocker(
  d: Pick<Delivery, "status" | "skipReason" | "createdAt">,
  now: Date = new Date(),
): string | null {
  if (d.status !== "skipped") return "Already handled.";
  if (d.skipReason && UNSENDABLE_SKIP_REASONS.has(d.skipReason))
    return "Comments from the connected account (or for another account) are never answered.";
  if (!isWithinPrivateReplyWindow(d.createdAt, now))
    return "Older than 7 days: Instagram no longer allows a private reply to this comment.";
  return null;
}

/** The earliest comment time still inside the window at `now`. */
export function privateReplyWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - PRIVATE_REPLY_WINDOW_MS);
}

export interface RuleCandidate {
  campaign: Campaign;
  rule: Rule;
}

type DeliveryForCandidates = Pick<Delivery, "mediaId" | "skipReason" | "ruleId" | "commentText">;

/**
 * Rules the operator may send manually for a skipped comment, in engine order: active rules of
 * active campaigns for that post, then "all posts" campaigns. For a `no_campaign_for_post` row the
 * rule it matched on the other post's campaign is offered first. `all` is every active campaign
 * with its active rules (`loadActiveCampaigns`). Pure.
 */
export function manualRuleCandidates(
  all: readonly CampaignWithRules[],
  d: DeliveryForCandidates,
): RuleCandidate[] {
  const out = campaignsForMedia(all, d.mediaId).flatMap((c) =>
    c.rules.map((rule) => ({ campaign: c.campaign, rule })),
  );
  if (d.skipReason === "no_campaign_for_post" && d.ruleId && !out.some((x) => x.rule.id === d.ruleId)) {
    for (const c of all) {
      const rule = c.rules.find((r) => r.id === d.ruleId);
      if (rule) return [{ campaign: c.campaign, rule }, ...out];
    }
  }
  return out;
}

/**
 * The rule to pre-select in the "Send manually" dialog: for `no_campaign_for_post` rows the rule it
 * matched on the other post (if still offered); otherwise the one the engine would pick for this
 * text now (same tiering and priority as {@link pickMatch}); `null` when nothing matches.
 */
export function preselectRuleId(
  d: DeliveryForCandidates,
  all: readonly CampaignWithRules[],
  opts: { isReply?: boolean } = {},
): string | null {
  const candidates = manualRuleCandidates(all, d);
  if (d.skipReason === "no_campaign_for_post" && d.ruleId && candidates.some((x) => x.rule.id === d.ruleId))
    return d.ruleId;
  if (!d.commentText) return null;
  return pickMatch(d.commentText, campaignsForMedia(all, d.mediaId), opts)?.rule.id ?? null;
}

/**
 * Keyword recorded in `deliveries.matched_keyword` for a manual send of `rule`: the rule's keyword
 * found in the text now, else {@link ANY_KEYWORD} ("*"; the operator chose the rule, no keyword
 * matched). `{keyword}` in templates renders empty for "*", as for `any` rules.
 */
export function manualKeyword(text: string | null, rule: Pick<Rule, "keywords" | "matchMode">): string {
  if (!text || rule.matchMode === "any") return ANY_KEYWORD;
  // Ignore `isActive` here: the operator explicitly chose this rule.
  return matchComment(text, [{ ...rule, isActive: true }])?.keyword ?? ANY_KEYWORD;
}

/** Builds the match the send path uses for a manually chosen rule. */
export function manualMatch(text: string | null, campaign: Campaign, rule: Rule): ResolvedMatch {
  return { campaign, rule, keyword: manualKeyword(text, rule) };
}

export interface SendPreview {
  /** Every non-empty public reply variant, rendered (one is picked at random when sending). */
  publicReplies: string[];
  /** Rendered DM text (empty = no DM). */
  dm: string;
  /** Link button appended to the DM, if the rule has one. */
  button: { title: string; url: string } | null;
}

/** What a manual send of `rule` would post for this comment (mirrors the send path's rendering). */
export function previewSend(
  rule: Pick<Rule, "publicReplies" | "dmMessage" | "dmButtonTitle" | "dmButtonUrl">,
  vars: { username: string | null; keyword: string },
  limits: { commentMax: number; dmMax: number },
): SendPreview {
  const tv = { username: vars.username, keyword: templateKeyword(vars.keyword) };
  return {
    publicReplies: rule.publicReplies
      .filter((r) => r.trim())
      .map((r) => truncateText(renderTemplate(r, tv).trim(), limits.commentMax))
      .filter(Boolean),
    dm: truncateText(renderTemplate(rule.dmMessage, tv).trim(), limits.dmMax),
    button:
      rule.dmButtonTitle && rule.dmButtonUrl ? { title: rule.dmButtonTitle, url: rule.dmButtonUrl } : null,
  };
}
