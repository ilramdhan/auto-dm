# Troubleshooting

## "Setup needed" or "Something went wrong" right after deploying

The server is missing required environment variables. Set `DATABASE_URL` (or connect the Vercel
Supabase integration, which provides `POSTGRES_URL`) and `APP_SECRET` (at least 32 characters, e.g.
`openssl rand -base64 48`) under Vercel → Project → Settings → Environment Variables, then
**redeploy**. Migrations run during the build, so a build without a database URL creates no tables.
The home page and `/login` list which variables are missing.

## Dashboard is slow or stuck on loading skeletons

Almost always the Vercel function region is far from the database. Open `/api/health` twice: the
second `latencyMs` should be under ~50. If it is 150+, set **Vercel → Project → Settings →
Functions → Function Region** to the region of your Supabase project (the pooler host shows it, e.g.
`aws-0-ap-southeast-2` → `syd1`) and redeploy. See [deployment.md](deployment.md) step 3.

If pages end in an error instead, check **Vercel → Logs**: a wrong `DATABASE_URL` now fails after 10
seconds instead of hanging. `DATABASE_URL` must be the **Transaction pooler** (port 6543); the
Session pooler (5432) is only for `DATABASE_URL_UNPOOLED`.

## My test comment did nothing

Open **Settings → Instagram → Webhook diagnostics** first. It lists the last webhook requests Meta
sent to the app (time, result, number of comments, and whether they were for your account), the last
verification handshake, and the result of the last webhook subscription.

| What you see                                                        | Meaning and fix                                                                                                                                                                                     |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity row **Skipped · Own comment**                              | You commented with the connected account. Its comments are never answered (loop protection). Test from a **second account**.                                                                        |
| **No row in Activity** and **no webhook deliveries** in diagnostics | Meta isn't sending anything. Usually the app is in **Development mode** and the commenter isn't an accepted **Instagram Tester**, or `comments` isn't subscribed. Work through the checklist below. |
| Deliveries with **Signature invalid**                               | The App Secret in Settings is not the **Instagram App Secret** of the app that sends the webhook (Instagram → API setup with Instagram login, not App settings → Basic). Save the right one.        |
| Deliveries with **Not configured**                                  | No App Secret is saved yet. Add it in Settings → Instagram → Meta app.                                                                                                                              |
| Deliveries **Accepted** but **Account: Other account**              | Meta sent the comment for a different Instagram account id (the dashboard's **Test** button sends a sample like this). Reconnect the account the post belongs to.                                   |
| Last verification **Verify failed**                                 | The verify token in Meta doesn't match the one in Settings. Copy it again and click **Verify and save**.                                                                                            |
| Activity row **Skipped · No keyword matched / Automation paused**   | The webhook works. Check the campaign (post, schedule, active), keywords and match mode with **Test a comment**, or turn automation back on in Settings → Processing.                               |
| Account subscription **Failed**                                     | Click **Re-subscribe webhooks**. If it still fails, reconnect Instagram and accept every permission.                                                                                                |

Checklist when nothing arrives:

1. Meta's callback URL is exactly `{APP_URL}/api/webhooks/instagram` (or your n8n URL in n8n mode).
2. **Verify and save** succeeded (diagnostics shows the last verification as _Verified_).
3. The `comments` field is subscribed in the Meta dashboard, and **Account subscription** says
   _Subscribed_ (use **Re-subscribe webhooks** if not).
4. You comment from a **second account**, never the connected one.
5. In **Development mode** that second account is added under **App roles → Roles → Instagram
   Testers** and has **accepted** the invite in Instagram (Settings → Apps and websites → Tester
   invites). Without that, Meta sends nothing.
6. To answer everyone else, the app must be **Live**, with Advanced Access for the comments
   permission ([meta-setup](meta-setup.md#part-8---development-vs-live-mode-important)).
7. The connected account is **public** and a Business or Creator account.

## Webhook does not fire (no rows in Activity)

1. **App mode**: in Development mode only app-role users trigger webhooks. Switch to **Live** ([meta-setup](meta-setup.md#part-8---development-vs-live-mode-important)).
2. **Tester**: commenting account must be a tester (in Development) and your IG account must have accepted the invite.
3. **Subscription**: `comments` field subscribed in the dashboard **and** the account subscribed (reconnect Instagram).
4. **Advanced Access / App Review**: if Live mode still delivers nothing for public commenters, request Advanced Access for the comments permission (⚠ unconfirmed requirement).
5. The post's account must be a professional account; own comments never trigger replies.
6. Kill switch off? **Settings -> Processing**. Mode `n8n` vs `webhook` must match your Meta callback.
7. Check Vercel function logs for `/api/webhooks/instagram`.

## Verify and save fails in Meta

Callback URL must be HTTPS and public, exactly `{APP_URL}/api/webhooks/instagram`; verify token must equal the one in Settings. Make sure `APP_SECRET` hasn't changed (the verify token is encrypted with it).

## 401 / invalid signature

The Meta **App Secret** saved in Settings must belong to the same app that sends the webhook (use the Instagram app secret if it differs). Behind n8n, forward the raw body and original `X-Hub-Signature-256` unchanged.

## Token expired / "Invalid OAuth access token"

Tokens last ~60 days and are refreshed daily by cron. Check `CRON_SECRET` and the cron run in Vercel. Fix: **Settings -> Instagram -> Connect Instagram** again.

## DM not delivered

- Private replies: **one per comment**, within **7 days**; a second attempt for the same comment fails.
- User must not have blocked messages; the commenter's account may restrict message requests.
- Missing `instagram_business_manage_messages` permission: reconnect and accept all permissions.
- Message over 1000 characters or invalid button URL: shorten; check the error in Activity.
- Rate limited (~750 private replies/hour/account, ⚠ verify): retry later.

## Public reply posted but no DM (status `partial`)

See the error in the Activity row; usually one of the above.

## Migrations fail on build

- On Vercel, `DATABASE_URL_UNPOOLED` must be the Supabase **Session pooler** (port 5432 on
  `…pooler.supabase.com`). The "Direct connection" host `db.<ref>.supabase.co` is IPv6-only on the free
  plan and unreachable from Vercel builds.
- Verify the DB password (URL-encode special characters) and that the Supabase project isn't paused.
- `type "delivery_source" already exists` (or another "already exists"): the SQL files were run by
  hand in the Supabase SQL editor. Current versions detect this and mark them as applied; update to the
  latest release and redeploy. Do not drop the tables.
- Never edit applied migrations; add a new one.

## Logging

**Where:** Vercel → Project → Logs (filter by text). Docker: `docker compose logs -f app`.

Every event is one JSON line:

```json
{
  "time": "2026-10-15T10:00:00.000Z",
  "ts": "2026-10-15T10:00:00.000Z",
  "level": "info",
  "scope": "webhook",
  "msg": "webhook.received",
  "event": "webhook.received",
  "requestId": "fra1::abc-123",
  "events": 1,
  "durationMs": 4
}
```

`ts` and `event` are aliases of `time` and `msg`, kept so older searches still work.

**Searching:**

- `scope`: `"scope":"webhook"`, `engine`, `graph`, `n8n`, `cron`, `oauth`, `auth`, `health`, `app`.
- `requestId`: the `x-vercel-id` of the request (or `x-request-id`, else a random UUID). The webhook, n8n, cron and
  OAuth routes log it on every line, including the background processing of a comment, so search the id to see its whole journey.
- Error "Reference": the code shown on the "Something went wrong" page is the error digest. Search it
  (`"digest":"1234567890"`) to find the `request.unhandled_error` line with the error name, path, method and route.

**Verbosity:** set `LOG_LEVEL` to `debug`, `info`, `warn` or `error` (default `info` in production, `debug` in
development; an invalid value falls back to `info`). Stack traces are logged only at `debug` or outside production.

**Never logged:** access tokens, app secret, verify token, passwords, cookies, `Authorization` headers, signatures,
request headers/bodies or full webhook payloads, and SQL parameters. Values under keys such as `token`, `secret`,
`password`, `authorization`, `cookie` or `api_key` are replaced by `[redacted]`, and long strings are truncated.

## Locked out / forgot password

Delete the user row (`delete from users;`) in the Supabase SQL editor; the default admin is expected to be recreated on the next login attempt (⚠ verify against the auth bootstrap); change the password again.

## Changed `APP_SECRET`

Everyone is logged out and stored secrets cannot be decrypted: re-enter the Meta app secret and reconnect Instagram.
