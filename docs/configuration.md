# Configuration

## Environment variables

| Variable                 | Required | Default                      | Notes                                           |
| ------------------------ | -------- | ---------------------------- | ----------------------------------------------- |
| `DATABASE_URL`           | yes*     | falls back to `POSTGRES_URL` | Supabase transaction pooler (6543)              |
| `DATABASE_URL_UNPOOLED`  | no       | -                            | Direct 5432 URL for migrations                  |
| `APP_SECRET`             | yes      | -                            | 32+ chars; sessions + encryption key            |
| `APP_URL`                | no       | Vercel production domain     | Used for OAuth redirect and webhook URL display |
| `ADMIN_DEFAULT_USERNAME` | no       | `admin`                      | First run only                                  |
| `ADMIN_DEFAULT_PASSWORD` | no       | `changeme123`                | Forced change at first login                    |
| `CRON_SECRET`            | no       | -                            | Protects `/api/cron/*`                          |

Generate secrets: `openssl rand -base64 48`.

## In-app settings (Settings page)

Stored in the `settings` table; secret ones are encrypted. Defined in `src/server/settings.ts`.

| Key                    | Secret | Description                                                                                                                 |
| ---------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| `meta.appId`           | no     | Numeric Meta/Instagram app id                                                                                               |
| `meta.appSecret`       | yes    | Meta app secret                                                                                                             |
| `webhook.verifyToken`  | yes    | Auto-generated; paste into Meta webhook config                                                                              |
| `processing.mode`      | no     | `webhook` (default) or `n8n`                                                                                                |
| `processing.enabled`   | no     | Kill switch (default on)                                                                                                    |
| `general.timezone`     | no     | IANA time zone for Analytics days and "Comments today" (default `UTC`; Settings → Processing)                               |
| `general.operatorName` | no     | Your name or business name, shown on the public `/privacy` and `/data-deletion` pages (Settings → Account → Public contact) |
| `general.contactEmail` | no     | Public contact email for privacy questions and deletion requests, shown on the same pages                                   |

Campaigns, rules and API keys are managed in their own pages.
