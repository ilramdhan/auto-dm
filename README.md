<div align="center">

# auto-reply-ig

**Comment a keyword on your Instagram post, get a public reply and a DM automatically. Free, self-hosted, open source.**

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![CI](https://github.com/ilramdhan/auto-reply-ig/actions/workflows/ci.yml/badge.svg)](https://github.com/ilramdhan/auto-reply-ig/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/ilramdhan/auto-reply-ig)](https://github.com/ilramdhan/auto-reply-ig/releases)
[![Docker image](https://img.shields.io/badge/ghcr.io-ilramdhan%2Fauto--reply--ig-2496ed?logo=docker&logoColor=white)](https://github.com/ilramdhan/auto-reply-ig/pkgs/container/auto-reply-ig)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg?logo=nextdotjs)](https://nextjs.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

An open-source alternative to ManyChat-style "comment to DM" tools, with no per-contact pricing.

</div>

<!-- Replace with real screenshots: docs/assets/dashboard.png, campaign-editor.png, activity-log.png -->

![Dashboard screenshot placeholder](docs/assets/dashboard.png)

## Features

- **Multi-post campaigns**: one campaign per post or reel, or one for "all posts".
- **Unlimited keywords per post**, each rule with its own replies (match modes: word, exact, contains; case, accent and emoji safe).
- **Random public-reply variants** so your replies don't look copy-pasted.
- **Personalised DMs** with `{username}` and `{keyword}`, plus an optional **link button**.
- **Once per user** per rule, and loop protection (your own replies are ignored).
- **Live activity log** with status, errors and skip reasons for every comment.
- **Kill switch** to pause all sending instantly.
- **Encrypted secrets** (AES-256-GCM): tokens and the Meta app secret are never stored in plain text.
- **Automatic token refresh** (daily cron), so the 60-day Instagram token never expires on you.
- **Optional n8n relay** if you want to extend flows with your own nodes.
- Accessible, responsive UI with dark mode ([ACCESSIBILITY.md](ACCESSIBILITY.md)).

## Deploy in 5 minutes

> You will need a free [Vercel](https://vercel.com), [Supabase](https://supabase.com) and GitHub account.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Filramdhan%2Fauto-reply-ig&env=APP_SECRET&envDescription=Random%20string%2C%2032%2B%20chars.%20Generate%20with%20%60openssl%20rand%20-base64%2048%60.%20Do%20not%20lose%20it.&envLink=https%3A%2F%2Fgithub.com%2Filramdhan%2Fauto-reply-ig%2Fblob%2Fmain%2Fdocs%2Fconfiguration.md&project-name=auto-reply-ig&repository-name=auto-reply-ig&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%7D%5D)

1. Click the button, set `APP_SECRET` (e.g. `openssl rand -base64 48`), and add the **Supabase** integration when asked. It injects the database variables automatically. _(⚠ verify: the `stores` integration/product slugs for Supabase may change; if the Supabase step doesn't appear, add the integration from the Vercel project's Storage tab, or paste `DATABASE_URL` manually. See [deployment.md](docs/deployment.md).)_
2. Vercel builds the app; **database migrations run automatically during the build**.
3. Open your new URL and log in with `admin` / `changeme123`. You are **forced to change the password** immediately.
4. Go to **Settings → Instagram** and follow the [Meta setup guide](docs/meta-setup.md) (about 15 minutes).
5. Create your first campaign, comment the keyword from another account, and watch the **Activity** page.

### Or self-host with Docker

```bash
git clone https://github.com/ilramdhan/auto-reply-ig.git && cd auto-reply-ig
cp .env.example .env     # set APP_SECRET, CRON_SECRET (and APP_URL for your public HTTPS URL)
docker compose up -d     # pulls ghcr.io/ilramdhan/auto-reply-ig, http://localhost:3000
```

Meta webhooks need HTTPS, so put a reverse proxy in front. See [docs/docker.md](docs/docker.md). Versions and
release process: [docs/releasing.md](docs/releasing.md).

## Local development

```bash
git clone https://github.com/ilramdhan/auto-reply-ig.git && cd auto-reply-ig
corepack enable && pnpm install          # Node 22 recommended (see .nvmrc)

# Postgres 15+: Supabase CLI (`supabase start`) or Docker:
docker run -d --name ig-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16

cp .env.example .env.local               # set DATABASE_URL and APP_SECRET
# DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
pnpm db:migrate
pnpm dev                                 # http://localhost:3000
```

Meta can't reach `localhost`; use a tunnel (cloudflared/ngrok) to test webhooks. Details: [docs/development.md](docs/development.md).

## How it works

```mermaid
sequenceDiagram
  participant U as Commenter
  participant IG as Instagram / Meta
  participant N as n8n (optional)
  participant A as auto-reply-ig
  participant DB as Postgres
  U->>IG: Comments "GUIDE" on your post
  IG->>A: POST /api/webhooks/instagram (signed)
  Note over IG,N: or Meta -> n8n -> POST /api/v1/n8n/events
  A->>A: Verify X-Hub-Signature-256, return 200
  A->>DB: Insert delivery (comment_id UNIQUE = idempotent)
  A->>A: Match campaign + rule + keyword
  A->>IG: Reply publicly (random variant)
  A->>IG: Private Reply DM (once per comment)
  A->>DB: Update delivery status (Activity log)
```

More in [docs/architecture.md](docs/architecture.md).

## Configuration

Only two variables are required; everything Instagram-related is set in the UI.

| Variable                                            | Required | Description                                                                                                       |
| --------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                      | yes*     | Postgres URL (Supabase transaction pooler, port 6543). *Falls back to `POSTGRES_URL` from the Vercel integration. |
| `DATABASE_URL_UNPOOLED`                             | no       | Direct connection (5432) used for migrations.                                                                     |
| `APP_SECRET`                                        | yes      | 32+ random chars. Signs sessions and derives the encryption key. Changing it invalidates stored secrets.          |
| `APP_URL`                                           | no       | Public URL. Defaults to the Vercel production domain.                                                             |
| `ADMIN_DEFAULT_USERNAME` / `ADMIN_DEFAULT_PASSWORD` | no       | First-run login (`admin` / `changeme123`); must be changed on first login.                                        |
| `CRON_SECRET`                                       | no       | Protects `/api/cron/*`; Vercel sends it automatically.                                                            |

Full reference: [docs/configuration.md](docs/configuration.md).

## FAQ

**Is it really free and unlimited?** The software has no fees or contact limits. Limits come from Meta (rate limits, one private reply per comment within 7 days) and your hosting tier. See [Is it free & unlimited?](docs/meta-setup.md#is-it-free-and-unlimited).

**Do I need a Facebook Page?** No. It uses _Instagram API with Instagram Login_ and a professional (Business or Creator) account.

**Do I need Meta App Review?** For your own account, Standard Access is the intended path. Whether public comments reach the webhook in Live mode without Advanced Access is not confirmed by Meta's docs, so test it. See [meta-setup.md](docs/meta-setup.md#standard-vs-advanced-access---do-i-need-app-review).

**Can I send a second DM?** Not with Private Replies: one per comment, within 7 days. Follow-ups are only possible after the user replies (24-hour window).

**Will Instagram ban me?** Automating replies to people who explicitly commented a keyword is a supported use case, but spammy behaviour can be throttled. Use varied replies and relevant messages.

**Is my data safe?** Secrets are encrypted at rest, RLS is enabled on every table, webhooks are signature-verified. See [SECURITY.md](SECURITY.md).

**Can I use n8n?** Yes, optionally: [docs/n8n.md](docs/n8n.md).

**It doesn't fire!** See [docs/troubleshooting.md](docs/troubleshooting.md).

## Roadmap ideas

Multi-account support, follower gate ("follow to get the link"), analytics and CSV export, internationalisation (i18n), scheduled campaigns UI improvements, story-reply triggers, webhook for outgoing events. Ideas and PRs welcome.

## 🇮🇩 Ringkasan

auto-reply-ig adalah aplikasi gratis dan open source untuk membalas komentar Instagram secara otomatis: ketika seseorang berkomentar dengan kata kunci tertentu, aplikasi membalas di kolom komentar dan mengirim DM. Tanpa biaya per kontak, bisa dipasang gratis di Vercel + Supabase.

- **Panduan lengkap berbahasa Indonesia (mulai dari sini): [docs/panduan-lengkap-id.md](docs/panduan-lengkap-id.md)** — Supabase, Vercel, Meta app, webhook, n8n, dan semua key yang dibutuhkan (tidak perlu API key AI).
- Deploy: [docs/deployment.md](docs/deployment.md).
- Setup aplikasi Meta/Instagram: [docs/meta-setup.md](docs/meta-setup.md).
- Masalah umum: [docs/troubleshooting.md](docs/troubleshooting.md).
- Catatan: Meta membatasi 1 balasan pribadi per komentar dalam 7 hari.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues: [SECURITY.md](SECURITY.md). Questions: [SUPPORT.md](SUPPORT.md).

## License

[MIT](LICENSE) © 2026 Ilham Ramadhan ([@ilramdhan](https://github.com/ilramdhan), [ilramdhan.dev](https://ilramdhan.dev), Instagram [@ilramadhan_](https://instagram.com/ilramadhan_)).

## Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/ilramdhan">
        <img src="https://avatars.githubusercontent.com/u/80036757?v=4" width="80" alt="" /><br />
        <sub><b>Ilham Ramadhan</b></sub>
      </a><br />
      <sub>Creator &amp; maintainer</sub>
    </td>
  </tr>
</table>

Want to see your name here? Read [CONTRIBUTING.md](CONTRIBUTING.md) and open a pull request.
The full list is on the [contributors graph](https://github.com/ilramdhan/auto-reply-ig/graphs/contributors).

## Acknowledgements

[Next.js](https://nextjs.org), [shadcn/ui](https://ui.shadcn.com), [Drizzle ORM](https://orm.drizzle.team), [Supabase](https://supabase.com), [Vercel](https://vercel.com), [n8n](https://n8n.io), and Meta's Instagram Platform.
