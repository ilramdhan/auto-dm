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
