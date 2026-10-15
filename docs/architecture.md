# Architecture

## Modules

```
src/app/            routes only: (auth), (dashboard), api/
src/server/db/      Drizzle schema + client; retry.ts retries reads once on dropped connections
src/server/auth/    argon2id, jose session cookie, requireUser()
src/server/instagram/  Graph API client, OAuth, token refresh, media listing
src/server/engine/  matching, templating, once-per-user, delivery pipeline
src/server/repos/   data access for the UI
src/server/n8n/     workflow generator
src/server/settings.ts  typed SETTINGS registry (encrypted secrets)
src/server/updates.ts   app version + GitHub Releases update check (Settings → About)
src/server/diagnostics.ts  DB ping + server region (Settings → About, /api/health)
src/server/crypto.ts    AES-256-GCM, HKDF, sha256, timing-safe compare
src/components/     shadcn/ui + app components
```

## Data model

```mermaid
erDiagram
  users { uuid id PK; text username UK; text password_hash; bool must_change_password; int session_version }
  login_attempts { uuid id PK; text key; timestamptz created_at }
  settings { text key PK; jsonb value }
  api_keys { uuid id PK; text name; text prefix; text key_hash UK; timestamptz revoked_at }
  instagram_accounts { uuid id PK; text ig_user_id UK; text username; text access_token_enc; timestamptz token_expires_at; bool is_active }
  campaigns { uuid id PK; uuid account_id FK; text name; text media_id; bool is_active; timestamptz starts_at; timestamptz ends_at }
  rules { uuid id PK; uuid campaign_id FK; text name; text[] keywords; enum match_mode; text[] public_replies; text dm_message; text dm_button_url; bool once_per_user; int priority }
  deliveries { uuid id PK; text comment_id UK; uuid campaign_id FK; uuid rule_id FK; text commenter_id; enum status; text error; enum source }
  data_deletion_requests { uuid id PK; text confirmation_code UK; text ig_user_id; enum status; timestamptz completed_at }
  instagram_accounts ||--o{ campaigns : has
  campaigns ||--o{ rules : has
  campaigns ||--o{ deliveries : "set null"
  rules ||--o{ deliveries : "set null"
```

`campaigns.media_id = NULL` means "all posts". `match_mode`: word, exact, contains. `delivery_status`:
received, processing, skipped, sent, partial, failed. `delivery_source`: webhook, n8n, manual.

## Request flows

**Webhook verify**: `GET /api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
returns the challenge if the stored verify token matches.

**Comment event**: `POST /api/webhooks/instagram` -> verify `X-Hub-Signature-256` on the raw body ->
Zod-parse -> respond 200 -> `after()` runs the engine: insert `deliveries` (conflict on `comment_id`
means duplicate, stop) -> ignore own comments -> resolve campaign (media-specific before "all posts",
date window, active) -> match rule by priority -> once-per-user check -> public reply (random variant)
-> private reply DM -> update status (`sent`, `partial` if one step failed, `failed`, `skipped` with reason).

**n8n mode**: n8n receives Meta's webhook, then `POST /api/v1/n8n/events` with `Authorization: Bearer <api key>`,
the original raw body and original `X-Hub-Signature-256`. Same engine, `source = n8n`.

**Token refresh**: `GET /api/cron/refresh-tokens` (Bearer `CRON_SECRET`) runs daily and refreshes
tokens nearing expiry. **Health**: `GET /api/health`.

**Recovery**: read paths retry once on connection-level errors (`withDbRetry`); error boundaries
re-render once, and reload once on version skew after a deploy (`src/lib/error-recovery.ts`,
guarded in `sessionStorage`). Open tabs and installed apps also compare their build id (inlined as
`NEXT_PUBLIC_BUILD_ID` in `next.config.ts`) with `GET /api/version` when they return to the
foreground and every 5 minutes, and a navigation watchdog offers a reload after 10 s
(`src/lib/app-update.ts`). Sign out is a plain form post to `POST /api/auth/logout` (same-origin
check), so it works on a stale bundle.

**Meta deauthorize / data deletion**: `POST /api/instagram/deauthorize` and
`POST /api/instagram/data-deletion` receive a form-encoded `signed_request` (HMAC-SHA256 with the app
secret, verified in constant time). Deauthorize wipes the matching account's token; data deletion
deletes the user's `deliveries` (as commenter or receiving account), wipes a matching account's token
and profile, records a `data_deletion_requests` row and answers `{ url, confirmation_code }`. Public
pages `/privacy` and `/data-deletion?code=...` need no sign-in.

## Idempotency

`deliveries.comment_id` is UNIQUE. Meta retries and duplicate n8n forwards hit the conflict and are
ignored, so a comment is never replied to twice.

## Security model

- Single admin; every mutation calls `requireUser()`. Machine routes: API key, Meta signature, or `CRON_SECRET`.
- CSV exports (`/activity/export`, `/analytics/export`) are `requireUser()`-guarded GET route handlers built
  with `src/lib/csv.ts` (RFC 4180, UTF-8 BOM, formula-injection guard, 50,000-row cap, dates in the configured time zone).
- Secrets encrypted (AES-256-GCM, key from HKDF(`APP_SECRET`)); never sent to the browser or logged.
- RLS enabled, no policies: the Supabase REST anon key sees nothing. The app uses a server-side Postgres connection.
- Outbound hosts: `graph.instagram.com` / `api.instagram.com` (Instagram API) and the fixed
  `api.github.com` releases URL for the Settings → About update check (cached 6 h, fails closed).
- See [SECURITY.md](../SECURITY.md).
