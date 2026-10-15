import "server-only";
import { cache } from "react";
import { z } from "zod";
import pkg from "../../package.json";
import { REPO_URL } from "@/lib/constants";
import { compareSemver, isUpdateAvailable, parseSemver } from "@/lib/semver";
import { logger } from "@/server/log";

/**
 * App version + "is there a newer release?" check against the public GitHub Releases API.
 * The only outbound host is the fixed `api.github.com` URL below (no user input). Results are
 * cached by Next's data cache for 6 hours; any failure (offline, rate limit, bad payload)
 * returns `{ ok: false }` so the Settings page never breaks.
 */

const log = logger("updates");

export const RELEASES_REVALIDATE_SECONDS = 6 * 60 * 60;
const TIMEOUT_MS = 4000;

function repoSlug(): { owner: string; repo: string } {
  const [owner = "", repo = ""] = new URL(REPO_URL).pathname.replace(/^\/|\/$/g, "").split("/");
  return { owner, repo };
}

const { owner, repo } = repoSlug();
export const REPO = {
  url: REPO_URL,
  releases: `${REPO_URL}/releases`,
  changelog: `${REPO_URL}/blob/main/CHANGELOG.md`,
  discussions: `${REPO_URL}/discussions`,
  bugReport: `${REPO_URL}/issues/new?template=bug_report.yml`,
  featureRequest: `${REPO_URL}/issues/new?template=feature_request.yml`,
  pulls: `${REPO_URL}/pulls`,
  securityAdvisory: `${REPO_URL}/security/advisories/new`,
  docs: `${REPO_URL}/blob/main/docs/README.md`,
  upgradeVercel: `${REPO_URL}/blob/main/docs/deployment.md#upgrading`,
  upgradeDocker: `${REPO_URL}/blob/main/docs/docker.md#upgrading`,
  regionDocs: `${REPO_URL}/blob/main/docs/deployment.md#3-deploy-the-app`,
} as const;
const RELEASES_API = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`;

export type AppVersion = {
  version: string;
  /** Short git SHA when the platform provides one (Vercel). */
  commit: string | null;
  /** "Vercel · production", "Vercel · preview", or "Self-hosted". */
  environment: string;
};

export function getAppVersion(): AppVersion {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const vercelEnv = process.env.VERCEL_ENV;
  return {
    version: pkg.version,
    commit: sha && /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 7) : null,
    environment: vercelEnv ? `Vercel · ${vercelEnv}` : process.env.VERCEL ? "Vercel" : "Self-hosted",
  };
}

const githubUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith("https://github.com/"), "not a github.com URL");

const ReleaseSchema = z.object({
  tag_name: z.string().min(1).max(100),
  name: z.string().max(200).nullable(),
  html_url: githubUrl,
  published_at: z.string().datetime({ offset: true }).nullable(),
  body: z.string().nullable(),
  draft: z.boolean(),
  prerelease: z.boolean(),
});

export type Release = {
  tag: string;
  name: string;
  url: string;
  publishedAt: string | null;
  body: string;
  prerelease: boolean;
};

export type UpdateCheck =
  | {
      ok: true;
      current: string;
      /** Newest stable release, if any. */
      latest: Release | null;
      updateAvailable: boolean;
      /** Up to 5 most recent published releases, newest first. */
      releases: Release[];
    }
  | { ok: false; current: string };

/** Pure: turn a raw (unknown) GitHub payload into an UpdateCheck. Exported for tests. */
export function interpretReleases(payload: unknown, current: string): UpdateCheck {
  if (!Array.isArray(payload)) return { ok: false, current };
  const releases: Release[] = [];
  for (const raw of payload) {
    const r = ReleaseSchema.safeParse(raw);
    if (!r.success || r.data.draft) continue;
    releases.push({
      tag: r.data.tag_name,
      name: r.data.name?.trim() || r.data.tag_name,
      url: r.data.html_url,
      publishedAt: r.data.published_at,
      body: (r.data.body ?? "").slice(0, 20_000),
      prerelease: r.data.prerelease,
    });
  }
  const stable = releases.filter((r) => !r.prerelease && parseSemver(r.tag));
  const latest = stable.reduce<Release | null>(
    (best, r) => (!best || compareSemver(r.tag, best.tag) === 1 ? r : best),
    null,
  );
  return {
    ok: true,
    current,
    latest,
    updateAvailable: latest ? isUpdateAvailable(current, latest.tag) : false,
    releases,
  };
}

/** Deduplicated per request (the About tab and its trigger badge both call it). */
export const checkForUpdates = cache(async (): Promise<UpdateCheck> => {
  const current = pkg.version;
  try {
    const res = await fetch(RELEASES_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "autodm",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: RELEASES_REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      log.warn("release_check.http_error", {
        status: res.status,
        rateLimitRemaining: res.headers.get("x-ratelimit-remaining"),
      });
      return { ok: false, current };
    }
    const result = interpretReleases(await res.json(), current);
    if (!result.ok) log.warn("release_check.bad_payload");
    return result;
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    log.warn("release_check.failed", { error: e.name, message: e.message.slice(0, 200) });
    return { ok: false, current };
  }
});
