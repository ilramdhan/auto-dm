# Contributing to AutoDM

Thanks for helping! By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
AI agents: also read [CLAUDE.md](CLAUDE.md) and `.claude/rules/`.

## Setup

```bash
corepack enable && pnpm install          # Node 22 (.nvmrc)
cp .env.example .env.local               # DATABASE_URL + APP_SECRET
pnpm db:migrate && pnpm dev
```

See [docs/development.md](docs/development.md) for local Postgres and tunnelling webhooks.

## Workflow

1. Open or pick an issue (look for `good first issue` and `help wanted`). Comment before large work.
2. Branch from `main`: `feat/<short-name>`, `fix/<short-name>`, `docs/<short-name>`, `chore/<short-name>`.
3. Commit with [Conventional Commits](https://www.conventionalcommits.org): `feat(engine): add exact match mode`, `fix(ui): label for keyword input`.
4. Run **`pnpm check`** (lint + typecheck + tests) before pushing. Format with `pnpm format`.
5. Open a PR using the template. Keep it focused and update the docs.

### PR titles and merging

PRs are **squash-merged**, so the **PR title becomes the commit message and the changelog entry**. It must be a
Conventional Commit: `type(scope): subject` with type one of `feat`, `fix`, `perf`, `refactor`, `docs`, `test`,
`build`, `ci`, `chore`, `revert`, `style`, and a subject starting in lowercase (for example
`fix(engine): ignore replies from the account owner`). Mark breaking changes with `!` (`feat!:`) and a
`BREAKING CHANGE:` footer. A CI check enforces this. Do not edit `CHANGELOG.md`; it is generated.

### Releases

Maintainers release by merging the automated Release PR. See [docs/releasing.md](docs/releasing.md).

## Database migrations

1. Edit `src/server/db/schema.ts`.
2. `pnpm db:generate` and commit the generated SQL in `drizzle/migrations`.
3. Never edit an applied migration; add a new one.
4. New tables need `ENABLE ROW LEVEL SECURITY` in a migration (Supabase exposes `public` over REST).
5. `pnpm db:migrate` locally; CI re-applies on a clean Postgres.

## Adding a setting

Add an entry to the `SETTINGS` registry in `src/server/settings.ts` with a Zod schema and `secret: true`
if it must be encrypted. Optional defaults go in `DEFAULTS`. Expose it to the UI only via
`getPublicSettings()`. Document it in [docs/configuration.md](docs/configuration.md).

## UI and accessibility rules

- Use shadcn/ui primitives; wrap rather than edit `src/components/ui/*`.
- Mobile-first. Every input has a `<Label>`; visible focus; keyboard operable.
- Never rely on colour alone for status (add text or icon). Respect `prefers-reduced-motion`.
- See [ACCESSIBILITY.md](ACCESSIBILITY.md) (WCAG 2.2 AA target).

## Testing

Vitest. Pure logic (matching, templating, signature verification, payload parsing) must have unit
tests. DB integration tests use `TEST_DATABASE_URL` (CI provides Postgres 16). Never put real
tokens or secrets in fixtures.

## PR checklist

- [ ] `pnpm check` passes
- [ ] Tests added/updated
- [ ] PR title is a valid Conventional Commit
- [ ] Docs updated (`CHANGELOG.md` is generated, do not edit)
- [ ] No secrets, tokens or personal data in code, logs or screenshots
- [ ] New inputs validated with Zod; mutations call `requireUser()`
- [ ] UI changes checked with keyboard and in dark mode

## Labels

Defined in [.github/labels.yml](.github/labels.yml) and synced automatically. Pull requests are labelled by
changed paths ([.github/labeler.yml](.github/labeler.yml)). Common ones: `good first issue`, `help wanted`,
`bug`, `enhancement`, `documentation`, `setup`, `meta-api` (Instagram/Meta behaviour), `needs-triage`
(new issues, awaiting review), and area labels such as `ui`, `engine`, `database`, `docker`, `n8n`.
