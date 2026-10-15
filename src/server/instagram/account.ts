import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { decrypt, encrypt } from "@/server/crypto";
import { db, retryable } from "@/server/db/client";
import { instagramAccounts, type InstagramAccount } from "@/server/db/schema";
import { IG_REFRESH_TOKEN_URL } from "./constants";
import { graphId, graphRequest } from "./graph";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Refresh when fewer than this many days are left (long-lived tokens last 60 days). */
export const REFRESH_THRESHOLD_DAYS = 15;

/** The connected (active) Instagram account, or `null` when none is connected. */
export const getActiveAccount = retryable(
  "account.getActiveAccount",
  async (): Promise<InstagramAccount | null> => {
    const [row] = await db
      .select()
      .from(instagramAccounts)
      .where(eq(instagramAccounts.isActive, true))
      .orderBy(desc(instagramAccounts.updatedAt))
      .limit(1);
    return row ?? null;
  },
);

/** Decrypts the account's long-lived access token. Throws if the account was disconnected. */
export function getAccessToken(account: Pick<InstagramAccount, "accessTokenEnc">): string {
  if (!account.accessTokenEnc) throw new Error("Instagram account is not connected (no access token)");
  return decrypt(account.accessTokenEnc);
}

export interface UpsertAccountInput {
  igUserId: string;
  username: string;
  name?: string | null;
  profilePictureUrl?: string | null;
  accessToken: string;
  expiresInSeconds?: number | null;
}

/**
 * Stores (or re-activates) an account with an encrypted token and makes it the only active one.
 * Existing campaigns stay attached because the row is upserted by `ig_user_id`.
 */
export async function upsertAccount(input: UpsertAccountInput): Promise<InstagramAccount> {
  const now = new Date();
  const values = {
    igUserId: input.igUserId,
    username: input.username,
    name: input.name ?? null,
    profilePictureUrl: input.profilePictureUrl ?? null,
    accessTokenEnc: encrypt(input.accessToken),
    tokenExpiresAt: input.expiresInSeconds ? new Date(now.getTime() + input.expiresInSeconds * 1000) : null,
    tokenRefreshedAt: now,
    isActive: true,
  };
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(instagramAccounts)
      .values(values)
      .onConflictDoUpdate({ target: instagramAccounts.igUserId, set: { ...values, updatedAt: now } })
      .returning();
    if (!row) throw new Error("Failed to store Instagram account");
    await tx
      .update(instagramAccounts)
      .set({ isActive: false })
      .where(and(ne(instagramAccounts.id, row.id), eq(instagramAccounts.isActive, true)));
    return row;
  });
}

/**
 * Disconnects the active account: best-effort webhook unsubscribe, then wipes the token and marks
 * it inactive. The row is kept so campaigns (FK cascade) survive a reconnect.
 */
export async function disconnectAccount(): Promise<void> {
  const account = await getActiveAccount();
  if (!account) return;
  try {
    await graphRequest({
      method: "DELETE",
      path: "/me/subscribed_apps",
      accessToken: getAccessToken(account),
      schema: z.unknown(),
      retries: 0,
      timeoutMs: 5_000,
    });
  } catch {
    // Token may already be invalid; disconnecting locally is what matters.
  }
  await db
    .update(instagramAccounts)
    .set({ isActive: false, accessTokenEnc: "", tokenExpiresAt: null })
    .where(eq(instagramAccounts.id, account.id));
}

/* ---------------------------------- media --------------------------------- */

const mediaSchema = z.object({
  id: graphId,
  caption: z.string().optional(),
  media_type: z.string().optional(),
  media_product_type: z.string().optional(),
  media_url: z.string().optional(),
  permalink: z.string().optional(),
  thumbnail_url: z.string().optional(),
  timestamp: z.string().optional(),
});

const mediaPageSchema = z.object({
  data: z.array(mediaSchema),
  paging: z
    .object({ cursors: z.object({ after: z.string().optional() }).optional(), next: z.string().optional() })
    .optional(),
});

export interface MediaItem {
  id: string;
  caption: string | null;
  /** IMAGE | VIDEO | CAROUSEL_ALBUM */
  mediaType: string | null;
  /** FEED | REELS | STORY | AD */
  mediaProductType: string | null;
  permalink: string | null;
  /** Thumbnail for videos/reels, the image itself otherwise. */
  thumbnailUrl: string | null;
  timestamp: string | null;
}

export interface MediaPage {
  items: MediaItem[];
  nextCursor: string | null;
}

/**
 * Lists the connected account's posts/reels (newest first) for the campaign media picker.
 * Throws when no account is connected.
 */
export async function listMedia(opts: { limit?: number; after?: string | null } = {}): Promise<MediaPage> {
  const account = await getActiveAccount();
  if (!account) throw new Error("No Instagram account connected");
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 24), 1), 50);
  const page = await graphRequest({
    path: "/me/media",
    accessToken: getAccessToken(account),
    query: {
      fields: "id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp",
      limit,
      after: opts.after ?? undefined,
    },
    schema: mediaPageSchema,
  });
  return {
    items: page.data.map((m) => ({
      id: m.id,
      caption: m.caption ?? null,
      mediaType: m.media_type ?? null,
      mediaProductType: m.media_product_type ?? null,
      permalink: m.permalink ?? null,
      thumbnailUrl: m.thumbnail_url ?? (m.media_type === "VIDEO" ? null : (m.media_url ?? null)),
      timestamp: m.timestamp ?? null,
    })),
    nextCursor: page.paging?.next ? (page.paging.cursors?.after ?? null) : null,
  };
}

/* ------------------------------ token refresh ------------------------------ */

export const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
});

export interface RefreshResult {
  refreshed: boolean;
  expiresAt: Date | null;
}

/**
 * Refreshes the long-lived token when fewer than {@link REFRESH_THRESHOLD_DAYS} days remain (or
 * the expiry is unknown, or `force`). Meta only refreshes tokens that are >= 24h old.
 */
export async function refreshTokenIfNeeded(
  account: InstagramAccount,
  opts: { force?: boolean; now?: Date } = {},
): Promise<RefreshResult> {
  const now = opts.now ?? new Date();
  const expiresAt = account.tokenExpiresAt;
  const due = !expiresAt || expiresAt.getTime() - now.getTime() < REFRESH_THRESHOLD_DAYS * DAY_MS;
  if (!opts.force && !due) return { refreshed: false, expiresAt };

  const res = await graphRequest({
    path: IG_REFRESH_TOKEN_URL,
    query: { grant_type: "ig_refresh_token" },
    accessToken: getAccessToken(account),
    schema: tokenResponseSchema,
  });
  const newExpiresAt = res.expires_in ? new Date(now.getTime() + res.expires_in * 1000) : null;
  await db
    .update(instagramAccounts)
    .set({ accessTokenEnc: encrypt(res.access_token), tokenExpiresAt: newExpiresAt, tokenRefreshedAt: now })
    .where(eq(instagramAccounts.id, account.id));
  return { refreshed: true, expiresAt: newExpiresAt };
}
