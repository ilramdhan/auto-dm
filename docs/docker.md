# Self-hosting with Docker

Run AutoDM on any VPS or home server with Docker Compose. The image is published to GHCR:
`ghcr.io/ilramdhan/autodm`.

> **Renamed from `auto-reply-ig`.** Images up to the rename were published as
> `ghcr.io/ilramdhan/auto-reply-ig`, which no longer receives updates. Change `image:` in your
> `docker-compose.yml` to `ghcr.io/ilramdhan/autodm:latest` (or a pinned version), then
> `docker compose pull && docker compose up -d`. The database volume, `.env` and data are unchanged.

## Quick start

```bash
git clone https://github.com/ilramdhan/autodm.git && cd autodm
cp .env.example .env
# edit .env: set APP_SECRET (openssl rand -base64 48), CRON_SECRET (openssl rand -hex 32), APP_URL
docker compose up -d
```

The app listens on `http://localhost:3000`. Log in with `admin` / `changeme123`; you are forced to change the password.
Then follow the [Meta setup guide](meta-setup.md).

The compose file starts three services: `app`, `db` (Postgres 16) and `cron` (see below).

## Image tags

| Tag                 | Meaning                                |
| ------------------- | -------------------------------------- |
| `latest`            | newest release                         |
| `X.Y.Z`, `X.Y`, `X` | a specific release (`X` only from 1.0) |
| `edge`              | latest `main`, may be unstable         |
| `sha-xxxxxxx`       | a specific commit                      |

Images are multi-arch (amd64, arm64) and ship an SBOM and provenance attestation. Pin a version in production:

```yaml
services:
  app:
    image: ghcr.io/ilramdhan/autodm:0.2.0
```

## Environment variables

Set these in `.env` (compose passes them to the container). Full list: [configuration.md](configuration.md).

| Variable                               | Notes                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `APP_SECRET`                           | Required, 32+ chars. Back it up: losing it makes stored secrets unreadable.            |
| `APP_URL`                              | Your public HTTPS URL, used for OAuth redirect and webhook URL.                        |
| `CRON_SECRET`                          | Required for the daily token refresh sidecar.                                          |
| `DATABASE_URL`                         | Preset in compose to the bundled Postgres. Change the default password for production. |
| `ADMIN_DEFAULT_USERNAME` / `_PASSWORD` | First-run login only.                                                                  |
| `SKIP_MIGRATIONS=1`                    | Skip the automatic migration run at container start.                                   |

Change `POSTGRES_PASSWORD` in `docker-compose.yml` and the matching password in `DATABASE_URL` before exposing the stack.

## HTTPS is required for Meta webhooks

Meta only calls HTTPS endpoints with a valid certificate. Put a reverse proxy in front of port 3000.
Example with [Caddy](https://caddyserver.com) (automatic certificates), `Caddyfile`:

```text
ig.example.com {
    reverse_proxy app:3000
}
```

Run Caddy in the same compose network, or on the host with `reverse_proxy 127.0.0.1:3000`. Point your DNS
`A`/`AAAA` record at the server, open ports 80 and 443, set `APP_URL=https://ig.example.com`, and restart.
Consider binding the app port to localhost only (`"127.0.0.1:3000:3000"`) when a proxy runs on the host.

## Cron sidecar

On Vercel a cron job refreshes the 60-day Instagram token. In Docker the `cron` service (Alpine + crond)
calls `/api/cron/refresh-tokens` daily at 03:17 with `Authorization: Bearer $CRON_SECRET`. Keep `CRON_SECRET`
set, otherwise the route refuses the call. Check it with `docker compose logs cron`.

## Migrations and health

- Migrations run automatically every time the container starts. Set `SKIP_MIGRATIONS=1` to disable (for example when you run them separately).
- The container runs as a non-root user and has a healthcheck on `/api/health`:

```bash
curl -s http://localhost:3000/api/health   # {"status":"ok","db":"ok",...}
docker compose ps                           # shows (healthy)
```

## Upgrading

**Settings → About** tells you when a newer release exists and shows its notes.

```bash
# 1. read CHANGELOG.md for breaking changes, and back up the database (below)
# 2. bump the tag in docker-compose.yml (or keep :latest), then
docker compose pull
docker compose up -d
docker compose logs -f app
```

Pre-1.0 minor versions can contain breaking changes. See [releasing.md](releasing.md) for rollback.

## Backups

Data lives in the `db-data` volume. Back it up regularly:

```bash
docker compose exec -T db pg_dump -U autodm autodm | gzip > backup-$(date +%F).sql.gz
# restore into an empty database
gunzip -c backup-2026-01-01.sql.gz | docker compose exec -T db psql -U autodm autodm
```

Also store `APP_SECRET` somewhere safe; a database backup is useless without it.

## Troubleshooting

See [troubleshooting.md](troubleshooting.md). Quick checks: `docker compose logs app`, `docker compose ps`, and
that `APP_URL` matches the public URL configured in Meta.
