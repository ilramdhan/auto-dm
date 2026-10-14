import "server-only";

/**
 * Instagram API with Instagram Login endpoints.
 *
 * Graph API version: v25.0 was released 2026-02-18 (v26.0 on 2026-07-29). We pin to v25.0,
 * a version with a long support window that every endpoint used here supports. Bump deliberately
 * after reading https://developers.facebook.com/docs/graph-api/changelog/versions
 */
export const GRAPH_API_VERSION = "v25.0";
export const GRAPH_HOST = "https://graph.instagram.com";
export const GRAPH_BASE_URL = `${GRAPH_HOST}/${GRAPH_API_VERSION}`;

/** Authorization dialog (user-facing). */
export const IG_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
/** Code -> short-lived token exchange (note: api.instagram.com, not graph). */
export const IG_SHORT_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
/** Short-lived -> long-lived (60 days) exchange. Unversioned per Meta docs. */
export const IG_LONG_TOKEN_URL = `${GRAPH_HOST}/access_token`;
/** Long-lived token refresh (token must be >= 24h old and not expired). */
export const IG_REFRESH_TOKEN_URL = `${GRAPH_HOST}/refresh_access_token`;

export const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
] as const;

/** Meta limit for Private Reply / DM text. */
export const DM_MAX_CHARS = 1000;
/** Button template `text` limit (Messenger Platform templates). */
export const BUTTON_TEMPLATE_TEXT_MAX = 640;
/** Button title limit. */
export const BUTTON_TITLE_MAX = 20;
/** Instagram caption/comment limit. */
export const COMMENT_MAX_CHARS = 2200;
