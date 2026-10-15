# Configuration

## Environment variables

| Variable                 | Required | Default                      | Notes                                                                                 |
| ------------------------ | -------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | yes*     | falls back to `POSTGRES_URL` | Supabase transaction pooler (6543)                                                    |
| `DATABASE_URL_UNPOOLED`  | no       | -                            | Direct 5432 URL for migrations                                                        |
| `APP_SECRET`             | yes      | -                            | 32+ chars; sessions + encryption key                                                  |
| `APP_URL`                | no       | Vercel production domain     | OAuth redirect, webhook URL display, and SEO (canonical, Open Graph, sitemap, robots) |
| `ADMIN_DEFAULT_USERNAME` | no       | `admin`                      | First run only                                                                        |
| `ADMIN_DEFAULT_PASSWORD` | no       | `changeme123`                | Forced change at first login                                                          |
| `CRON_SECRET`            | no       | -                            | Protects `/api/cron/*`                                                                |
| `LOG_LEVEL`              | no       | `info` (`debug` in dev)      | `debug`, `info`, `warn` or `error`                                                    |

Generate secrets: `openssl rand -base64 48`.

Without `APP_URL` (and outside Vercel) canonical links and social-card URLs cannot be made absolute, and
`robots.txt` omits the sitemap line. Set it to your public HTTPS URL in production.

## Search engines, social cards and installing the app

- Indexable: `/`, `/privacy`, `/terms`, `/data-deletion` (listed in `/sitemap.xml`). Everything behind
  sign-in, `/login`, `/change-password` and `/api/` sends `noindex` and is disallowed in `/robots.txt`.
- Social previews use `/opengraph-image` and `/twitter-image` (1200x630, generated at build time).
- The dashboard can be installed as an app (web app manifest at `/manifest.webmanifest`, start URL
  `/dashboard`). A small service worker (`public/sw.js`) only shows an offline page when the network is
  down; it never caches pages or API responses.
- Icons are generated from `src/lib/brand-mark.ts` with `pnpm brand:icons` (see `scripts/brand/`); the
  README banner and GitHub social preview (`docs/assets/`) with `pnpm brand:banner`.

## In-app settings (Settings page)

Stored in the `settings` table; secret ones are encrypted. Defined in `src/server/settings.ts`.

| Key                        | Secret | Description                                                                                                                                                         |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta.appId`               | no     | Numeric Meta/Instagram app id                                                                                                                                       |
| `meta.appSecret`           | yes    | Meta app secret                                                                                                                                                     |
| `webhook.verifyToken`      | yes    | Auto-generated; paste into Meta webhook config                                                                                                                      |
| `webhook.subscription`     | no     | Last webhook subscription result (`ok`, time, `connect`/`manual`, subscribed fields, error). Written on Connect and by Settings → Instagram → Re-subscribe webhooks |
| `processing.mode`          | no     | `webhook` (default) or `n8n`                                                                                                                                        |
| `processing.enabled`       | no     | Kill switch (default on)                                                                                                                                            |
| `processing.retentionDays` | no     | Days to keep comment records before the daily cron deletes them: `30`, `90`, `180`, `365` (default) or `0` = keep forever (Settings → Processing → Data retention)  |
| `general.timezone`         | no     | IANA time zone for Analytics days and "Comments today" (default `UTC`; Settings → Processing)                                                                       |
| `general.operatorName`     | no     | Your name or business name, shown on the public `/privacy` and `/data-deletion` pages (Settings → Account → Public contact)                                         |
| `general.contactEmail`     | no     | Public contact email for privacy questions and deletion requests, shown on the same pages                                                                           |

Campaigns, rules and API keys are managed in their own pages.
