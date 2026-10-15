# Releasing

Releases are automated with [release-please](https://github.com/googleapis/release-please). Maintainers
never edit `package.json` versions or `CHANGELOG.md` by hand.

## Versioning

- [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
- Versions come from [Conventional Commits](https://www.conventionalcommits.org). PRs are squash-merged, so the **PR title** is the commit message (enforced by the `PR title` workflow).

| Commit type                                         | Effect                   | Changelog section |
| --------------------------------------------------- | ------------------------ | ----------------- |
| `feat`                                              | minor                    | Features          |
| `fix`                                               | patch                    | Bug Fixes         |
| `perf`                                              | patch                    | Performance       |
| `revert`                                            | patch                    | Reverts           |
| `docs`                                              | patch                    | Documentation     |
| `refactor`, `test`, `build`, `ci`, `chore`, `style` | no release by themselves | hidden            |
| `feat!:` / `fix!:` or `BREAKING CHANGE:` footer     | major (minor while 0.x)  | Features / Fixes  |

### Pre-1.0 semantics

While the version is `0.x` (`bump-minor-pre-major`), a breaking change bumps the **minor** version
(`0.2.0` to `0.3.0`) and a `feat` bumps the minor too, so expect breaking changes between minors.
The `1.0.0` release is cut deliberately (see "Forcing a version").

## How a release happens

1. PRs merge into `main` with Conventional Commit titles.
2. On every push to `main`, the `Release` workflow opens or updates a **Release PR** titled `chore(main): release x.y.z` containing the version bump and changelog.
3. When a maintainer merges that PR, release-please bumps `package.json`, writes `CHANGELOG.md`, creates the tag `vX.Y.Z` and a GitHub Release.
4. The same workflow then triggers the Docker publish to GHCR.

### Docker tags

Image: `ghcr.io/ilramdhan/auto-dm` (linux/amd64 and linux/arm64, with SBOM and provenance).
Built on native amd64 and arm64 runners (no QEMU). To re-publish a release image, run Actions → Docker → Run workflow with `version` set (e.g. `0.6.0`).

| Event            | Tags                                                   |
| ---------------- | ------------------------------------------------------ |
| Pull request     | built only, not pushed                                 |
| Push to `main`   | `edge`, `sha-xxxxxxx`                                  |
| Release `vX.Y.Z` | `X.Y.Z`, `X.Y`, `X` (only for 1.0 and later), `latest` |

## Cutting a release (maintainers)

1. Check the open Release PR: version and changelog entries look right. If an entry is wrong, fix it in the Release PR's changelog text before merging.
2. Make sure CI is green on the Release PR.
3. Merge it (squash or merge commit; keep the title). Tag, GitHub Release and Docker images follow automatically.
4. Verify the Release page and `docker pull ghcr.io/ilramdhan/auto-dm:X.Y.Z`.

### Forcing a version

Add a footer to any commit that lands on `main` (for example in the PR description of a squash merge, or an empty commit):

```text
chore: release 1.0.0

Release-As: 1.0.0
```

## Making CI run on Release PRs

PRs created with the default `GITHUB_TOKEN` do not trigger other workflows, so CI will not run on the
Release PR. To fix this:

1. Create a fine-grained personal access token limited to this repository with **Contents: read/write** and **Pull requests: read/write**.
2. Save it as the repository secret `RELEASE_PLEASE_TOKEN`. The release workflow uses it when present.
3. In **Settings, Actions, General** enable **Allow GitHub Actions to create and approve pull requests** (required in both cases).

## Vercel

Vercel deploys from `main` automatically on every push, so no workflow is needed. Releases are tags
for Docker users and for reference; Vercel users simply get the latest `main`. Pin a different branch or
tag in the Vercel project's Git settings if you prefer to deploy only releases.

## Rollback

- **Docker**: set the image tag to the previous version (`ghcr.io/ilramdhan/auto-dm:0.2.0`) and `docker compose up -d`. Migrations only move forward, so restore a database backup if the newer version applied a schema change that the older version cannot handle (see [docker.md](docker.md#backups)).
- **Vercel**: Project, Deployments, pick a previous deployment, **Promote to Production** (or "Instant Rollback").
- **Bad release**: fix forward with a `fix:` PR, or `revert:` the offending commit. Do not delete tags or releases that users may have pulled.
