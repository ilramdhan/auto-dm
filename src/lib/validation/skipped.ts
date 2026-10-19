import { z } from "zod";

/** Why a comment was skipped (stored in `deliveries.skip_reason`; see server/engine/process-comment.ts). */
export const SKIP_REASONS = [
  "no_account",
  "account_mismatch",
  "own_comment",
  "empty_comment",
  "no_match",
  "no_campaign_for_post",
  "processing_disabled",
  "already_delivered",
  "no_actions",
  "not_delivered",
] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

/** Hidden on the Skipped comments page unless picked in the reason filter: they can't be sent. */
export const HIDDEN_SKIP_REASONS = [
  "own_comment",
  "account_mismatch",
] as const satisfies readonly SkipReason[];

/** Reason filter value that also shows the hidden reasons. */
export const ALL_REASONS = "all";

export const SKIPPED_PAGE_SIZE = 25;

/** Parses `/skipped` search params; invalid values fall back to defaults instead of erroring. */
export const skippedFiltersSchema = z.object({
  reason: z
    .enum([...SKIP_REASONS, ALL_REASONS])
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});
export type SkippedFilters = z.infer<typeof skippedFiltersSchema>;

/** "Send manually" dialog and server action input. */
export const manualSendSchema = z.object({
  deliveryId: z.uuid(),
  ruleId: z.uuid({ message: "Choose a rule to send" }),
  /** Send even if this person already got this rule's DM ("Once per user" override). */
  ignoreOncePerUser: z.boolean().optional(),
});
export type ManualSendInput = z.infer<typeof manualSendSchema>;

/** "Check post for missed comments": one campaign, or every active post campaign when omitted. */
export const syncMissedSchema = z.object({ campaignId: z.uuid().optional() });
export type SyncMissedInput = z.infer<typeof syncMissedSchema>;
