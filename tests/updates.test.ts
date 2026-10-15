import { afterEach, describe, expect, it, vi } from "vitest";
import { checkForUpdates, interpretReleases } from "@/server/updates";

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  name: tag,
  html_url: `https://github.com/example/app/releases/tag/${tag}`,
  published_at: "2026-10-15T01:02:03Z",
  body: "### Features\n\n* thing",
  draft: false,
  prerelease: false,
  ...extra,
});

describe("interpretReleases", () => {
  it("picks the newest stable release and flags an update", () => {
    const r = interpretReleases(
      [
        release("v1.0.0-rc.1", { prerelease: true }),
        release("v0.4.0"),
        release("v0.5.0", { draft: true }),
        release("v0.3.0"),
      ],
      "0.3.0",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.latest?.tag).toBe("v0.4.0");
    expect(r.updateAvailable).toBe(true);
    expect(r.releases.map((x) => x.tag)).toEqual(["v1.0.0-rc.1", "v0.4.0", "v0.3.0"]); // draft dropped
  });

  it("reports up to date when current is the latest", () => {
    const r = interpretReleases([release("v0.3.0")], "0.3.0");
    expect(r.ok && r.updateAvailable).toBe(false);
  });

  it("skips entries that fail validation (non-GitHub URLs, wrong types)", () => {
    const r = interpretReleases(
      [release("v9.0.0", { html_url: "https://evil.example/x" }), { tag_name: 1 }, release("v0.3.1")],
      "0.3.0",
    );
    expect(r.ok && r.releases.map((x) => x.tag)).toEqual(["v0.3.1"]);
  });

  it("fails closed on a non-array payload", () => {
    expect(interpretReleases({ message: "API rate limit exceeded" }, "0.3.0")).toEqual({
      ok: false,
      current: "0.3.0",
    });
  });
});

describe("checkForUpdates", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls the fixed GitHub releases URL with the expected headers", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([release("v99.0.0")]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await checkForUpdates();
    expect(r.ok && r.updateAvailable).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { next?: unknown }];
    expect(url).toBe("https://api.github.com/repos/ilramdhan/auto-reply-ig/releases?per_page=5");
    expect(init.headers).toMatchObject({
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "auto-reply-ig",
    });
    expect(init.next).toEqual({ revalidate: 21600 });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns ok:false on HTTP errors (rate limit) without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 403 })),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(checkForUpdates()).resolves.toMatchObject({ ok: false });
  });

  it("returns ok:false on network errors without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(checkForUpdates()).resolves.toMatchObject({ ok: false });
  });
});
