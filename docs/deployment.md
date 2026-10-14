# Deployment (Vercel + Supabase, free)

## Option A: Deploy button

1. Click **Deploy with Vercel** in the [README](../README.md).
2. Create the repo copy in your GitHub, set `APP_SECRET` (`openssl rand -base64 48`), and add the Supabase integration (creates a project and injects `POSTGRES_URL*` vars). ⚠ verify: the integration step may differ; use Option B if so.
3. Deploy. The build runs `tsx scripts/migrate.ts` before `next build`, so tables are created automatically.
4. Open the URL, log in `admin` / `changeme123`, change the password.
5. Continue with [meta-setup.md](meta-setup.md).

## Option B: Manual

1. **Supabase**: create a project at supabase.com. Project settings -> Database -> Connection string.
2. **Which connection string?**
   - `DATABASE_URL`: **Transaction pooler**, port **6543** (right for serverless runtime).
   - `DATABASE_URL_UNPOOLED`: **Session pooler**, port **5432** (same `pooler.supabase.com` host), used for migrations at build time. Do **not** use the "Direct connection" (`db.<ref>.supabase.co`) on Vercel: on the free plan it is IPv6-only and Vercel builds run on IPv4, so the migration step fails. If unset, migrations use `DATABASE_URL`.
3. **Vercel**: Add New -> Project -> import your fork. Framework: Next.js. Add env vars: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `APP_SECRET`, `CRON_SECRET` (`openssl rand -hex 32`).
4. Deploy. Check build logs for the migration step.

## Cron

`vercel.json` registers a daily call to `/api/cron/refresh-tokens` (Hobby allows once per day). Vercel
sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set. Without it the route refuses calls.

## Custom domain

Project -> Settings -> Domains. Set `APP_URL=https://your.domain` and redeploy; then update the OAuth
redirect URI and webhook callback URL in the Meta dashboard.

## Upgrading

Pull upstream into your fork (`git pull upstream main` or GitHub "Sync fork"), push, Vercel redeploys and
applies new migrations. Read `CHANGELOG.md` first. Back up the DB before major versions.

## Back up `APP_SECRET`

Losing or changing it makes stored Meta/Instagram secrets unreadable; reconnect Instagram and re-enter the app secret.

## Notes

Supabase Free pauses projects after about a week of inactivity (⚠ verify); the daily cron keeps it active.
Vercel Hobby is intended for non-commercial use (⚠ check current terms).
