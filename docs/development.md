# Development

## Requirements

Node 22 (`.nvmrc`), pnpm 10 (`corepack enable`), Postgres 15+.

## Local Postgres

```bash
docker run -d --name ig-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
# or: supabase init && supabase start   (DB at postgresql://postgres:postgres@127.0.0.1:54322/postgres)
```

`.env.local`:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
APP_SECRET=<openssl rand -base64 48>
APP_URL=http://localhost:3000
```

Then `pnpm db:migrate && pnpm dev`. Log in with `admin` / `changeme123`.

## Webhooks locally

Expose port 3000 with `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`, set
`APP_URL` to the HTTPS URL, and use it in Meta's dashboard.

## Scripts

| Script                                            | Purpose                                                   |
| ------------------------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                                        | Dev server                                                |
| `pnpm check`                                      | lint + typecheck + test                                   |
| `pnpm lint` / `typecheck` / `test` / `test:watch` | individual checks                                         |
| `pnpm format`                                     | Prettier                                                  |
| `pnpm db:generate` / `db:migrate` / `db:studio`   | Drizzle                                                   |
| `pnpm build`                                      | migrate + `next build`; `pnpm build:app` skips migrations |

## Testing

Vitest in `tests/` and next to modules. DB tests use `TEST_DATABASE_URL`. Pure logic needs unit tests.

## Structure

See [architecture.md](architecture.md) and [CLAUDE.md](../CLAUDE.md). Contribution rules: [CONTRIBUTING.md](../CONTRIBUTING.md).

## Dependency policy

`pnpm-workspace.yaml` sets `minimumReleaseAge: 10080`: pnpm only resolves package versions that
have been published for at least **7 days**, which protects against freshly published malicious
releases. Dependabot uses the same 7-day cooldown. If `pnpm add` fails with
`ERR_PNPM_NO_MATURE_MATCHING_VERSION`, pick a slightly older version. For an urgent security fix,
add the package to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` in the same PR and explain
why.
