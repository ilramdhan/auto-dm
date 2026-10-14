import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { appUrl } from "@/env";
import { deriveKey, randomToken, safeEqual } from "@/server/crypto";
import type { InstagramAccount } from "@/server/db/schema";
import { getSettings } from "@/server/settings";
import { tokenResponseSchema, upsertAccount } from "./account";
import { IG_AUTHORIZE_URL, IG_LONG_TOKEN_URL, IG_SCOPES, IG_SHORT_TOKEN_URL } from "./constants";
import { GraphApiError, graphId, graphRequest } from "./graph";

export const OAUTH_STATE_COOKIE = "ig_oauth_state";
export const OAUTH_STATE_MAX_AGE_S = 10 * 60;
export const OAUTH_CALLBACK_PATH = "/api/instagram/oauth/callback";

/** Machine-readable failure reasons surfaced to the settings page as `?error=<code>`. */
export type OAuthErrorCode =
  | "missing_app_credentials"
  | "access_denied"
  | "invalid_state"
  | "missing_code"
  | "missing_permissions"
  | "token_exchange_failed"
  | "profile_fetch_failed";

export class OAuthFlowError extends Error {
  override readonly name = "OAuthFlowError";
  constructor(
    readonly code: OAuthErrorCode,
    readonly cause?: unknown,
  ) {
    super(code);
  }
}

/** The redirect URI registered in the Meta app dashboard. */
export function oauthRedirectUri(): string {
  return `${appUrl()}${OAUTH_CALLBACK_PATH}`;
}

/* ---------------------------------- state ---------------------------------- */

function signState(state: string): string {
  return createHmac("sha256", deriveKey("session")).update(`ig-oauth:${state}`).digest("base64url");
}

/** New CSRF state: `state` goes to Instagram, `cookieValue` into an httpOnly cookie. */
export function createOAuthState(): { state: string; cookieValue: string } {
  const state = randomToken(32);
  return { state, cookieValue: `${state}.${signState(state)}` };
}

/** Timing-safe check that the returned `state` matches the signed cookie. */
export function verifyOAuthState(returnedState: string | null, cookieValue: string | undefined): boolean {
  if (!returnedState || !cookieValue) return false;
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return false;
  const state = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  return safeEqual(sig, signState(state)) && safeEqual(state, returnedState);
}

/* ---------------------------------- flow ----------------------------------- */

async function getAppCredentials(): Promise<{ appId: string; appSecret: string }> {
  const s = await getSettings(["meta.appId", "meta.appSecret"]);
  const appId = s["meta.appId"];
  const appSecret = s["meta.appSecret"];
  if (!appId || !appSecret) throw new OAuthFlowError("missing_app_credentials");
  return { appId, appSecret };
}

/** Builds the Instagram Business Login authorization URL. */
export async function buildAuthorizeUrl(state: string): Promise<string> {
  const { appId } = await getAppCredentials();
  const url = new URL(IG_AUTHORIZE_URL);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", oauthRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", IG_SCOPES.join(","));
  url.searchParams.set("state", state);
  url.searchParams.set("enable_fb_login", "0");
  url.searchParams.set("force_reauth", "true");
  return url.toString();
}

const permissionsSchema = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((p) => (typeof p === "string" ? p.split(",").map((s) => s.trim()) : p));

/** Docs show both a flat object and a `{ data: [...] }` wrapper; accept either. */
const shortTokenItem = z.object({ access_token: z.string().min(1), permissions: permissionsSchema });
const shortTokenSchema = z.union([
  shortTokenItem,
  z.object({ data: z.array(shortTokenItem).min(1) }).transform((d) => d.data[0]!),
]);

const profileSchema = z.object({
  user_id: graphId,
  username: z.string().min(1),
  name: z.string().optional(),
  profile_picture_url: z.string().optional(),
});

const subscribeSchema = z.object({ success: z.boolean().optional() });

export interface ConnectResult {
  account: InstagramAccount;
  /** False when the account was saved but the webhook subscription failed (retryable). */
  subscribed: boolean;
}

/**
 * Completes the OAuth flow: code -> short-lived -> long-lived token, fetch profile, store the
 * encrypted token, subscribe the app to `comments` webhooks. Throws {@link OAuthFlowError}.
 */
export async function completeOAuth(rawCode: string): Promise<ConnectResult> {
  const { appId, appSecret } = await getAppCredentials();
  // Instagram appends `#_` to the code in the redirect; strip it if it leaked into the value.
  const code = rawCode.replace(/#_$/, "");

  let longToken: z.infer<typeof tokenResponseSchema>;
  try {
    const short = await graphRequest({
      method: "POST",
      path: IG_SHORT_TOKEN_URL,
      form: {
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: oauthRedirectUri(),
        code,
      },
      schema: shortTokenSchema,
      retries: 0,
    });
    if (short.permissions && !IG_SCOPES.every((s) => short.permissions!.includes(s))) {
      throw new OAuthFlowError("missing_permissions");
    }
    longToken = await graphRequest({
      path: IG_LONG_TOKEN_URL,
      query: { grant_type: "ig_exchange_token", client_secret: appSecret },
      accessToken: short.access_token,
      schema: tokenResponseSchema,
    });
  } catch (err) {
    if (err instanceof OAuthFlowError) throw err;
    throw new OAuthFlowError("token_exchange_failed", err);
  }

  let profile: z.infer<typeof profileSchema>;
  try {
    profile = await graphRequest({
      path: "/me",
      query: { fields: "user_id,username,name,profile_picture_url" },
      accessToken: longToken.access_token,
      schema: profileSchema,
    });
  } catch (err) {
    throw new OAuthFlowError("profile_fetch_failed", err);
  }

  const account = await upsertAccount({
    igUserId: profile.user_id,
    username: profile.username,
    name: profile.name ?? null,
    profilePictureUrl: profile.profile_picture_url ?? null,
    accessToken: longToken.access_token,
    expiresInSeconds: longToken.expires_in ?? null,
  });

  const subscribed = await subscribeToWebhooks(longToken.access_token);
  return { account, subscribed };
}

/** Subscribes the app to the account's `comments` webhook field. Returns false on failure. */
export async function subscribeToWebhooks(accessToken: string): Promise<boolean> {
  try {
    const res = await graphRequest({
      method: "POST",
      path: "/me/subscribed_apps",
      query: { subscribed_fields: "comments" },
      accessToken,
      schema: subscribeSchema,
      idempotent: true,
    });
    return res.success !== false;
  } catch (err) {
    if (err instanceof GraphApiError) return false;
    throw err;
  }
}
