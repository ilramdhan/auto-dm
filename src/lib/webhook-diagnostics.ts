/**
 * Webhook diagnostics: labels and the "why did my test comment do nothing?" verdict shown in
 * Settings → Instagram. Pure and isomorphic (no DB, no `server-only`).
 */

export const WEBHOOK_REQUEST_RESULTS = [
  "accepted",
  "signature_invalid",
  "not_configured",
  "invalid_payload",
  "too_large",
  "api_key_invalid",
  "error",
  "verified",
  "forbidden",
] as const;
export type WebhookRequestResult = (typeof WEBHOOK_REQUEST_RESULTS)[number];
export type WebhookRequestKind = "delivery" | "verification";
export type WebhookRequestSource = "direct" | "n8n";

/** How many delivery rows / verification rows are kept (ring buffer). */
export const WEBHOOK_LOG_KEEP_DELIVERIES = 50;
export const WEBHOOK_LOG_KEEP_VERIFICATIONS = 10;

export type BadgeTone = "success" | "warning" | "danger" | "muted" | "info";

export const WEBHOOK_RESULT_META: Record<
  WebhookRequestResult,
  { label: string; tone: BadgeTone; help: string }
> = {
  accepted: { label: "Accepted", tone: "success", help: "Signature valid; comments were processed." },
  signature_invalid: {
    label: "Signature invalid",
    tone: "danger",
    help: "Rejected (401): the App Secret saved in Settings is not the secret of the app sending this webhook.",
  },
  not_configured: {
    label: "Not configured",
    tone: "danger",
    help: "Rejected (412): no App Secret is saved yet, so the signature can't be checked.",
  },
  invalid_payload: {
    label: "Invalid payload",
    tone: "warning",
    help: "Rejected (422): the body wasn't a Meta webhook payload.",
  },
  too_large: { label: "Too large", tone: "warning", help: "Rejected (422): the body exceeded 1 MB." },
  api_key_invalid: {
    label: "API key invalid",
    tone: "danger",
    help: "Rejected (401): the n8n request had a missing, wrong or revoked API key.",
  },
  error: { label: "Server error", tone: "danger", help: "The app failed while handling the request." },
  verified: { label: "Verified", tone: "success", help: "Meta's “Verify and save” handshake succeeded." },
  forbidden: {
    label: "Verify failed",
    tone: "danger",
    help: "Meta's handshake was refused (403): the verify token in Meta doesn't match the one here.",
  },
};

/** Minimal row shape the verdict needs (a DB `WebhookRequest` satisfies it). */
export interface WebhookRequestSummary {
  kind: WebhookRequestKind;
  result: WebhookRequestResult;
  commentEvents: number | null;
  /** Entries addressed to the connected account (null = no account connected at the time). */
  matchedEntries: number | null;
  entries: number | null;
  createdAt: Date;
}

export type WebhookVerdict =
  /** Nothing ever arrived: Meta isn't calling the callback URL. */
  | "never_received"
  /** Only the verification handshake arrived, never a comment. */
  | "verified_only"
  /** The latest delivery was rejected (signature / configuration). */
  | "rejected"
  /** Deliveries arrive, but for a different account id (e.g. the dashboard "Test" sample). */
  | "other_account"
  /** Deliveries for the connected account arrive and are accepted. */
  | "ok";

/**
 * Picks the most useful explanation from the recent requests (newest first or any order).
 * Looks at the newest delivery: a rejection wins over older successes, so a freshly broken App
 * Secret is reported straight away.
 */
export function webhookVerdict(rows: readonly WebhookRequestSummary[]): WebhookVerdict {
  const sorted = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latestDelivery = sorted.find((r) => r.kind === "delivery");
  if (!latestDelivery) {
    return sorted.some((r) => r.kind === "verification" && r.result === "verified")
      ? "verified_only"
      : "never_received";
  }
  if (latestDelivery.result !== "accepted") return "rejected";
  const accepted = sorted.filter((r) => r.kind === "delivery" && r.result === "accepted");
  const anyForUs = accepted.some((r) => r.matchedEntries === null || r.matchedEntries > 0);
  return anyForUs ? "ok" : "other_account";
}

/** Human description of a delivery row's account match, for the deliveries table. */
export function matchLabel(row: Pick<WebhookRequestSummary, "entries" | "matchedEntries">): string {
  if (row.entries === null) return "—";
  if (row.matchedEntries === null) return "No account connected";
  if (row.entries === 0) return "No entries";
  if (row.matchedEntries === row.entries) return "Your account";
  if (row.matchedEntries === 0) return "Other account";
  return `${row.matchedEntries} of ${row.entries} for your account`;
}

/** Outcome of `POST /me/subscribed_apps`, persisted in the `webhook.subscription` setting. */
export interface SubscriptionStatus {
  ok: boolean;
  /** ISO timestamp. */
  at: string;
  source: "connect" | "manual";
  /** Fields reported by `GET /me/subscribed_apps`, when it could be read. */
  fields?: string[];
  /** Short, token-free error description when `ok` is false. */
  error?: string;
}

/**
 * Keeps at most `limit` events per `windowMs` (per server instance). Used to cap how many rejected,
 * unauthenticated webhook requests are written to the database.
 */
export function createThrottle(limit: number, windowMs: number): (now?: number) => boolean {
  let windowStart = 0;
  let count = 0;
  return (now = Date.now()) => {
    if (now - windowStart >= windowMs) {
      windowStart = now;
      count = 0;
    }
    if (count >= limit) return false;
    count++;
    return true;
  };
}
