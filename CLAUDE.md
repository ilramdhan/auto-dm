# CLAUDE.md — working rules for AI agents and contributors

auto-reply-ig: Instagram comment-keyword → public reply + DM automation. Next.js 15 (App Router) +
Supabase Postgres (Drizzle) + shadcn/ui. Read `plan.md` for architecture and module ownership.

## Commands

```bash
pnpm dev            # http://localhost:3000
pnpm check          # lint + typecheck + unit tests (run before every commit)
pnpm build          # runs migrations (if a DB URL is set) then next build
pnpm db:generate    # after editing src/server/db/schema.ts -> new SQL in drizzle/migrations
pnpm db:migrate     # apply migrations
```

Local DB: any Postgres 15+. `.env.local` needs `DATABASE_URL` and `APP_SECRET` (see `.env.example`).

## Layout

- `src/app/` routes only (thin). `(auth)` and `(dashboard)` route groups; `api/` route handlers.
- `src/server/` server-only logic (`import "server-only"` at the top of every file):
  `db/` schema+client · `auth/` · `instagram/` Graph API · `engine/` matching & delivery ·
  `repos/` data access for the UI · `n8n/` · `settings.ts` · `crypto.ts`.
- `src/components/ui/` shadcn primitives (don't edit for one-off styling; wrap instead).
- `src/lib/` isomorphic helpers and Zod schemas shared by forms and server actions.
- `drizzle/migrations/` generated SQL — never edit an applied migration; add a new one.

## Rules

1. **Validate at every boundary with Zod**: env, form/server-action input, webhook payloads,
   API bodies, Graph API responses you depend on.
2. **Secrets never reach the browser.** Use `getPublicSettings()` for UI; secret settings are
   encrypted with `encrypt()`; tokens live only in `instagram_accounts.access_token_enc`.
3. **Every mutation requires auth**: server actions and admin routes call `requireUser()` first.
   Machine routes use `verifyApiKey()` or the Meta signature; cron uses `CRON_SECRET`.
4. **Webhooks**: verify `X-Hub-Signature-256` on the raw body before parsing; respond 200 fast and
   do work in `after()`; idempotency via `deliveries.comment_id` UNIQUE.
5. **Never log** tokens, secrets, passwords, or full webhook bodies.
6. Schema changes: edit `schema.ts` → `pnpm db:generate` → commit the SQL. New tables must get
   `ENABLE ROW LEVEL SECURITY` in a migration (Supabase exposes `public` via REST).
7. UI: shadcn components, mobile-first, every input has a `<Label>`, visible focus, no
   color-only status, respect `prefers-reduced-motion`. See `ACCESSIBILITY.md`.
8. TypeScript strict, no `any` (use `unknown` + Zod). Server components by default; add
   `"use client"` only where interaction needs it.
9. Tests: pure logic (matching, templating, signature, parsing) must have Vitest tests.
10. Keep PRs focused; update `CHANGELOG.md` and docs when behavior changes.

## Instagram API notes

Instagram API with Instagram Login (`graph.instagram.com`). Scopes:
`instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`.
Private Reply: one DM per comment, within 7 days, `POST /{ig-user-id}/messages` with
`recipient: { comment_id }`. DM text ≤ 1000 chars. See `docs/meta-setup.md`.
