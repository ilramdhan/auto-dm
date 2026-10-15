/** Human labels for engine skip reasons (see server/engine/process-comment.ts). */
export const SKIP_REASON_LABELS: Record<string, string> = {
  no_account: "No Instagram account connected",
  account_mismatch: "Comment for a different account",
  own_comment: "Own comment / reply (loop protection)",
  empty_comment: "Empty comment",
  no_match: "No keyword matched",
  processing_disabled: "Automation paused (kill switch)",
  already_delivered: "Already messaged this user (once per user)",
  no_actions: "Rule has nothing to send",
  unknown: "Unknown",
};

export function skipReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "—";
  return SKIP_REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}

/**
 * Longer, actionable explanations for skip reasons that commonly confuse people testing their setup
 * (shown inline in Activity). Reasons without an entry only show their short label.
 */
export const SKIP_REASON_EXPLANATIONS: Record<string, string> = {
  own_comment:
    "You commented with the connected account, and its own comments are never answered (this also stops reply loops). Test with a second account that's an Instagram Tester of your app.",
  account_mismatch:
    "This comment was sent for a different Instagram account than the one connected. Reconnect the account you're testing with in Settings → Instagram.",
  no_match:
    "No active rule's keyword matched this comment. Check the campaign's post, its schedule, the keywords and the match mode with “Test a comment”.",
  processing_disabled:
    "A rule matched, but automation is paused, so nothing was sent. Turn it back on in Settings → Processing.",
  no_account:
    "No Instagram account was connected when the comment arrived. Connect one in Settings → Instagram.",
  already_delivered:
    "This person already got this rule's DM and “Once per user” is on. Test with another account or turn it off.",
};

/** Explanation for a skip reason, or `null` when there is nothing more to say than the label. */
export function skipReasonExplanation(reason: string | null | undefined): string | null {
  return reason ? (SKIP_REASON_EXPLANATIONS[reason] ?? null) : null;
}

/** Common Graph API error codes worth explaining in the UI. */
export const GRAPH_ERROR_HINTS: Record<string, string> = {
  "4": "App rate limit reached — wait and retry",
  "10": "Permission denied — check app permissions / Live mode",
  "100": "Invalid parameter (comment deleted or too old?)",
  "190": "Access token expired or revoked — reconnect Instagram",
  "200": "Missing permission",
  "368": "Temporarily blocked for policy reasons",
  "551": "User can't receive messages (privacy settings)",
  "613": "Rate limit reached",
  "2018001": "No matching user / private reply window expired",
  "2534022": "Private reply window (7 days) expired",
  unknown: "Unclassified error",
};
