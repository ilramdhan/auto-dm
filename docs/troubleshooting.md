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

## Locked out / forgot password

Delete the user row (`delete from users;`) in the Supabase SQL editor; the default admin is expected to be recreated on the next login attempt (⚠ verify against the auth bootstrap); change the password again.

## Changed `APP_SECRET`

Everyone is logged out and stored secrets cannot be decrypted: re-enter the Meta app secret and reconnect Instagram.
