# auto-reply-ig — Build Plan & Progress Tracker

Open-source Instagram **comment → keyword → public reply + DM** automation.
One deployment handles **all** posts/reels and **any number of keywords**, each with its own replies.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (see note)

Model policy (cost/context): **Sonnet** = light tasks (docs, templates, config, research summaries) ·
**Opus** = medium/heavy tasks (architecture, security-sensitive code, engine, complex UI).

---

## Architecture (decided)

| Concern | Choice | Why |
|---|---|---|
| App | Next.js 15 App Router, TypeScript strict, React 19 | Free on Vercel Hobby, server actions, `after()` for post-response work |
| UI | shadcn/ui (Radix + Tailwind v4), lucide, sonner, next-themes | Accessible primitives, fully responsive, dark mode |
| DB | Supabase Postgres via Drizzle ORM + `postgres` driver | Typed queries, SQL migrations in `drizzle/migrations`, auto-applied on build |
| Validation | Zod v4 everywhere (env, forms, webhook payloads, API) | One schema → types + runtime checks |
| Auth | Single admin; argon2id hashes; jose-signed httpOnly cookie with `session_version` | First run: default creds → forced password change |
| Secrets | Meta app secret, IG tokens, verify token encrypted (AES-256-GCM, key via HKDF(APP_SECRET)) | Only `DATABASE_URL` + `APP_SECRET` in env; everything else set in the UI |
| Instagram | Instagram API with Instagram Login (graph.instagram.com): OAuth connect, comments webhook, Private Replies, comment replies | No Facebook Page required, free |
| Idempotency | `deliveries.comment_id` UNIQUE | Meta retries & n8n duplicates never double-DM |
| Token refresh | Vercel Cron daily → refresh long-lived token (60-day expiry) | Zero maintenance |
| n8n (optional) | One generic relay workflow, downloadable pre-filled from Settings | Covers every post/keyword; extend with your own nodes |
| Quality | ESLint, Prettier, `tsc --noEmit`, Vitest, GitHub Actions CI | Contributor-friendly |

### Module ownership (to avoid agent conflicts)

```
src/env.ts, src/server/db/*, src/server/crypto.ts, src/server/settings.ts   → Phase 0 (lead)
src/server/instagram/*, src/server/engine/*, src/server/api-keys.ts,
src/app/api/**                                                             → Engine agent
src/server/auth/*, src/middleware.ts, src/components/**, src/lib/validation/*,
src/server/repos/*, src/app/(auth)/**, src/app/(dashboard)/**, src/app/layout.tsx,
src/app/page.tsx, src/app/globals.css                                      → UI agent
n8n/*, src/server/n8n/*                                                     → n8n agent
README.md, docs/*, .github/*, LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md,
SECURITY.md, ACCESSIBILITY.md, CHANGELOG.md, vercel.json                    → Docs agent
```

### Cross-module contracts

- `server/engine/match.ts` → `matchComment(text, rules) => { rule, keyword } | null` (pure, UI uses it for "test a comment").
- `server/engine/template.ts` → `renderTemplate(tpl, { username, keyword })`.
- `server/instagram/account.ts` → `getActiveAccount()`, `listMedia(opts)`, `disconnectAccount()`; OAuth start URL route `/api/instagram/oauth/start`.
- `server/api-keys.ts` → `createApiKey(name) => { id, key }` (plaintext shown once), `listApiKeys()`, `revokeApiKey(id)`, `verifyApiKey(bearer)`.
- `server/n8n/workflow.ts` → `buildN8nWorkflow({ appUrl }) => object` (UI offers it as a download).
- Webhook: `GET/POST /api/webhooks/instagram` (Meta direct). n8n relay: `POST /api/v1/n8n/events`
  (`Authorization: Bearer <api key>`, original `X-Hub-Signature-256`, original raw body) → `{ results: [...] }`.
- Cron: `GET /api/cron/refresh-tokens` (Bearer `CRON_SECRET`). Health: `GET /api/health`.

---

## Phase 0 — Foundation · Lead (Opus)

- [x] Decide architecture & stack (table above)
- [x] Move the reel project to `content/drive-claude-reel/`; app at repo root
- [x] Scaffold Next.js 15 + TS strict + Tailwind v4 + pnpm
- [x] Env schema (`src/env.ts`) — only `DATABASE_URL` + `APP_SECRET` required
- [x] DB schema (`users, login_attempts, settings, api_keys, instagram_accounts, campaigns, rules, deliveries`)
- [x] Migrations `0000_init`, `0001_enable_rls` (RLS on, no policies → Supabase anon key can't read anything)
- [x] Auto-migrate before `next build` (`scripts/migrate.ts`)
- [x] Crypto helpers (AES-256-GCM, HKDF, sha256, timing-safe compare)
- [x] Typed settings registry (`src/server/settings.ts`)
- [x] Tooling: ESLint, Prettier, Vitest, `components.json` (shadcn), `.env.example`
- [x] `plan.md`, `CLAUDE.md`

## Phase 1A — Instagram engine · Engine agent (Opus)

- [ ] Graph API client with typed errors, timeouts, retry on 5xx/429 (`server/instagram/graph.ts`)
- [ ] OAuth connect: start + callback, short → long-lived token, store encrypted, subscribe webhooks (`comments`)
- [ ] Token refresh (cron route) + `vercel.json` cron entry handed to Docs agent
- [ ] Webhook route: GET verify (verify token), POST with `X-Hub-Signature-256` HMAC check on raw body, Zod payload parse, 200 fast + `after()` processing
- [ ] Engine: campaign/rule resolution (media-specific before "all posts", date window, priority), keyword matcher (word/exact/contains, Unicode/emoji-safe, case/diacritic-insensitive), templating, once-per-user, loop protection (ignore own comments/replies)
- [ ] Actions: public comment reply (random variant) + Private Reply DM (text, optional button) with per-step status → `deliveries`
- [ ] n8n relay endpoint + API keys module
- [ ] Media listing for UI picker
- [ ] Unit tests (matcher, signature, payload parsing, templating) + integration test against local Postgres

## Phase 1B — Dashboard UI & auth · UI agent (Opus)

- [ ] shadcn primitives in `src/components/ui/*` (button, input, label, textarea, card, badge, switch, select, tabs, dialog, sheet, dropdown-menu, table, tooltip, alert, skeleton, separator, sonner)
- [ ] App shell: responsive sidebar (sheet on mobile), theme toggle, skip-link, accessible landmarks
- [ ] Auth: first-run bootstrap (default creds) → forced password change, argon2id, jose session cookie, `session_version`, login rate-limit, middleware + `requireUser()`
- [ ] Dashboard: setup checklist (Meta app → connect IG → webhook → first campaign), stats
- [ ] Campaigns: list, create (media picker or "all posts"), edit, activate/deactivate, delete
- [ ] Rules editor: keyword chips, match mode, public-reply variants, DM text with variables + 1000-char counter, link button, once-per-user, priority, "test a comment" simulator
- [ ] Activity log: deliveries table, filters, pagination, error details
- [ ] Settings: account (username/password), Instagram (app id/secret, connect/disconnect, webhook URL + verify token copy), processing (mode, kill switch), n8n (API keys, download workflow)
- [ ] Accessibility pass (labels, focus, contrast, keyboard, reduced motion)

## Phase 1C — n8n workflow · n8n agent (Sonnet)

- [x] Importable workflow JSON (`n8n/auto-reply-ig.workflow.json`): verify relay (GET) + event relay (POST, raw body + signature) + result branch (notify-on-failure placeholder)
- [x] `buildN8nWorkflow({ appUrl })` generator used by Settings download
- [x] `docs/n8n.md` step-by-step (import, credentials, Meta callback URL → n8n, test)

## Phase 1D — Docs, OSS hygiene, research · Docs agent (Sonnet)

- [x] Research & verify 2026 Meta requirements (permissions, app review/Live mode, Private Replies limits, webhooks, rate limits) → `docs/meta-setup.md`
- [x] README (features, screenshots placeholders, 1-click Deploy to Vercel + Supabase, quick start, architecture diagram, FAQ incl. "is it free/unlimited?")
- [x] CONTRIBUTING, CODE_OF_CONDUCT (Contributor Covenant 2.1), LICENSE (MIT), SECURITY, ACCESSIBILITY, CHANGELOG, SUPPORT
- [x] `docs/` (architecture, deployment, configuration, development, troubleshooting), `.claude/rules/*`
- [x] `.github/` issue & PR templates, CI workflow (lint, typecheck, test, build with Postgres service), dependabot, CODEOWNERS placeholder
- [x] `vercel.json` (cron, function config)

## Phase 2 — Integration & QA · Lead (Opus)

- [ ] Merge agent outputs, resolve contract mismatches
- [ ] `pnpm check` + `pnpm build` green; integration run against local Postgres
- [ ] Security review (auth, webhook signature, secrets never sent to client, RLS)
- [ ] End-to-end smoke: login → change password → settings → create campaign/rule → simulated webhook → delivery row
- [ ] Commit & push

## Phase 3 — Hand-off · Lead

- [ ] Summary to owner: deploy steps, Meta app setup, what still needs a human (App Review / Live mode)

---

### Progress log

| Date | Phase | Note |
|---|---|---|
| 2026-10-14 | 0 | Foundation done; migrations verified on local Postgres 16 |
| 2026-10-14 | 1D | Docs, OSS files, CI, vercel.json done. Meta facts partly unverified (⚠ in docs/meta-setup.md): App Review need for public comments, button in private reply, rate limits, Graph version |
| 2026-10-14 | 1C | n8n workflow JSON, `buildN8nWorkflow` + tests, `docs/n8n.md` done |
