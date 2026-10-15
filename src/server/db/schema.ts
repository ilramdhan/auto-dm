import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ---------------------------------- auth ---------------------------------- */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  /** Bumped on password change / logout-everywhere; embedded in session JWTs. */
  sessionVersion: integer("session_version").notNull().default(1),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
});

/** Failed-login throttling (works across serverless instances). */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(), // e.g. `ip:1.2.3.4` or `user:admin`
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_key_created_idx").on(t.key, t.createdAt)],
);

/* -------------------------------- settings -------------------------------- */

/**
 * Key/value app settings. Secret values are AES-256-GCM encrypted (see server/crypto.ts)
 * and stored as `{ "enc": "<v1:...>" }`. Typed access lives in server/settings.ts.
 */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  ...timestamps,
});

/** API keys for machine clients (n8n). Looked up by `prefix`, verified against an argon2id `key_hash`. */
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(), // first chars shown in UI, e.g. "ard_live_ab12"
  keyHash: text("key_hash").notNull().unique(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------- instagram ------------------------------- */

export const instagramAccounts = pgTable("instagram_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  igUserId: text("ig_user_id").notNull().unique(),
  username: text("username").notNull(),
  name: text("name"),
  profilePictureUrl: text("profile_picture_url"),
  /** Encrypted long-lived Instagram User access token. */
  accessTokenEnc: text("access_token_enc").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  tokenRefreshedAt: timestamp("token_refreshed_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

/* ------------------------------ campaigns/rules ---------------------------- */

/** A campaign = one piece of content (or "all posts" when mediaId is null). */
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").references(() => instagramAccounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** Instagram media id. NULL = applies to every post/reel of the account. */
    mediaId: text("media_id"),
    mediaPermalink: text("media_permalink"),
    mediaThumbnailUrl: text("media_thumbnail_url"),
    mediaCaption: text("media_caption"),
    isActive: boolean("is_active").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("campaigns_media_idx").on(t.mediaId), index("campaigns_active_idx").on(t.isActive)],
);

export const matchMode = pgEnum("match_mode", ["word", "exact", "contains"]);

/** A rule = set of keywords -> public reply variants + DM. Many per campaign. */
export const rules = pgTable(
  "rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keywords: text("keywords")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    matchMode: matchMode("match_mode").notNull().default("word"),
    /** One is picked at random per comment. Empty = no public reply. Supports {username}. */
    publicReplies: text("public_replies")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Private reply (DM) text. Supports {username}, {keyword}. Max 1000 chars (Meta limit). */
    dmMessage: text("dm_message").notNull(),
    /** Optional link button appended to the DM (generic template). */
    dmButtonTitle: text("dm_button_title"),
    dmButtonUrl: text("dm_button_url"),
    /** Only DM a given commenter once per rule. */
    oncePerUser: boolean("once_per_user").notNull().default(true),
    priority: integer("priority").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("rules_campaign_idx").on(t.campaignId)],
);

/* -------------------------------- deliveries ------------------------------- */

export const deliveryStatus = pgEnum("delivery_status", [
  "received",
  "processing",
  "skipped",
  "sent",
  "partial",
  "failed",
]);

/** Outcome of each individual action, so analytics can report reply vs DM success separately. */
export const actionStatus = pgEnum("action_status", ["not_attempted", "sent", "failed"]);

export const deliverySource = pgEnum("delivery_source", ["webhook", "n8n", "manual"]);

/**
 * One row per incoming comment. `comment_id` is UNIQUE -> idempotency guard against
 * Meta webhook retries and duplicate n8n forwards.
 */
export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commentId: text("comment_id").notNull(),
    mediaId: text("media_id"),
    igUserId: text("ig_user_id"), // the receiving (our) account
    commenterId: text("commenter_id"),
    commenterUsername: text("commenter_username"),
    commentText: text("comment_text"),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    ruleId: uuid("rule_id").references(() => rules.id, { onDelete: "set null" }),
    matchedKeyword: text("matched_keyword"),
    status: deliveryStatus("status").notNull().default("received"),
    skipReason: text("skip_reason"),
    publicReplyStatus: actionStatus("public_reply_status").notNull().default("not_attempted"),
    publicReplyId: text("public_reply_id"),
    dmStatus: actionStatus("dm_status").notNull().default("not_attempted"),
    dmMessageId: text("dm_message_id"),
    /** Graph API error code of the last failure (e.g. 10, 551) for grouping in analytics. */
    errorCode: text("error_code"),
    /** End-to-end processing time in ms. */
    durationMs: integer("duration_ms"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    source: deliverySource("source").notNull().default("webhook"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("deliveries_comment_id_uq").on(t.commentId),
    index("deliveries_rule_commenter_idx").on(t.ruleId, t.commenterId),
    index("deliveries_created_idx").on(t.createdAt),
    index("deliveries_status_idx").on(t.status),
    index("deliveries_campaign_created_idx").on(t.campaignId, t.createdAt),
    index("deliveries_media_created_idx").on(t.mediaId, t.createdAt),
  ],
);

/* ------------------------------ data deletion ------------------------------ */

export const dataDeletionStatus = pgEnum("data_deletion_status", ["completed", "no_data"]);

/**
 * One row per data deletion request received from Meta (the user removed the app or asked for their
 * data to be deleted). `confirmation_code` is returned to Meta and shown on /data-deletion?code=...
 */
export const dataDeletionRequests = pgTable("data_deletion_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  confirmationCode: text("confirmation_code").notNull().unique(),
  /** Instagram-scoped user id from the signed request. */
  igUserId: text("ig_user_id"),
  status: dataDeletionStatus("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

/* ---------------------------- webhook diagnostics ---------------------------- */

export const webhookRequestKind = pgEnum("webhook_request_kind", ["delivery", "verification"]);
export const webhookRequestSource = pgEnum("webhook_request_source", ["direct", "n8n"]);
export const webhookRequestResult = pgEnum("webhook_request_result", [
  "accepted",
  "signature_invalid",
  "not_configured",
  "invalid_payload",
  "too_large",
  "api_key_invalid",
  "error",
  "verified",
  "forbidden",
]);

/**
 * Recent inbound webhook requests (POST deliveries and GET verification handshakes), kept as a small
 * ring buffer (pruned to the newest rows) so Settings can show whether Meta is reaching the app.
 * Never stores payload bodies, signatures or tokens: only counts and the outcome.
 */
export const webhookRequests = pgTable(
  "webhook_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: webhookRequestKind("kind").notNull(),
    source: webhookRequestSource("source").notNull().default("direct"),
    result: webhookRequestResult("result").notNull(),
    statusCode: integer("status_code").notNull(),
    /** `entry[]` items in the payload (null when the payload was not parsed). */
    entries: integer("entries"),
    /** Comment events extracted from the payload. */
    commentEvents: integer("comment_events"),
    /** Entries whose `entry[].id` is the connected account (null when no account was connected). */
    matchedEntries: integer("matched_entries"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_requests_created_idx").on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type InstagramAccount = typeof instagramAccounts.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type Rule = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;
export type Delivery = typeof deliveries.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type DataDeletionRequest = typeof dataDeletionRequests.$inferSelect;
export type WebhookRequest = typeof webhookRequests.$inferSelect;
