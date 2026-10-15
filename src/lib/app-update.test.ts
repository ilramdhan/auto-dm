import { describe, expect, it } from "vitest";
import {
  clientNavigationTarget,
  isOutdatedBuild,
  navigationKey,
  parseVersionResponse,
  shouldCheckVersion,
  VERSION_CHECK_MIN_INTERVAL_MS,
  type LinkClick,
} from "./app-update";
import { normalizeBuildId, resolveBuildId } from "./build-id";

describe("normalizeBuildId", () => {
  it("accepts deployment ids and commit SHAs", () => {
    expect(normalizeBuildId("dpl_8Xk2AbC")).toBe("dpl_8Xk2AbC");
    expect(normalizeBuildId(" 0a1b2c3d4e5f ")).toBe("0a1b2c3d4e5f");
    expect(normalizeBuildId("2f6c1b9e-1111-4c4c-8d8d-123456789abc")).toBe(
      "2f6c1b9e-1111-4c4c-8d8d-123456789abc",
    );
  });

  it.each([undefined, null, "", "   ", "undefined", "null", "unknown", "a b", "<script>", "x".repeat(201)])(
    "treats %j as unknown",
    (raw) => {
      expect(normalizeBuildId(raw)).toBeNull();
    },
  );
});

describe("resolveBuildId", () => {
  it("prefers the Vercel deployment id, then the commit, then the fallback", () => {
    expect(resolveBuildId({ VERCEL_DEPLOYMENT_ID: "dpl_1", VERCEL_GIT_COMMIT_SHA: "abc1234" }, "fb")).toBe(
      "dpl_1",
    );
    expect(resolveBuildId({ VERCEL_GIT_COMMIT_SHA: "abc1234" }, "fb")).toBe("abc1234");
    expect(resolveBuildId({ VERCEL_DEPLOYMENT_ID: "" }, "fb")).toBe("fb");
    expect(resolveBuildId({}, "")).toBe("unknown");
  });
});

describe("parseVersionResponse", () => {
  it("parses a valid body", () => {
    expect(parseVersionResponse({ version: "0.6.1", buildId: "dpl_1" })).toEqual({
      version: "0.6.1",
      buildId: "dpl_1",
    });
  });

  it.each([
    null,
    "x",
    {},
    { version: "0.6.1" },
    { version: 1, buildId: "dpl_1" },
    { version: "0.6.1", buildId: "unknown" },
  ])("rejects %j", (body) => {
    expect(parseVersionResponse(body)).toBeNull();
  });
});

describe("isOutdatedBuild", () => {
  it("is true only when both ids are known and differ", () => {
    expect(isOutdatedBuild("dpl_old", "dpl_new")).toBe(true);
    expect(isOutdatedBuild("dpl_same", "dpl_same")).toBe(false);
    expect(isOutdatedBuild(" dpl_same", "dpl_same ")).toBe(false);
  });

  it("never reports an outdated build when either side is unknown", () => {
    expect(isOutdatedBuild(undefined, "dpl_new")).toBe(false);
    expect(isOutdatedBuild("dpl_old", null)).toBe(false);
    expect(isOutdatedBuild("unknown", "dpl_new")).toBe(false);
    expect(isOutdatedBuild("dpl_old", "")).toBe(false);
  });
});

describe("shouldCheckVersion", () => {
  const now = 1_700_000_000_000;

  it("checks when never checked", () => {
    expect(shouldCheckVersion(null, now)).toBe(true);
  });

  it("throttles to the minimum interval", () => {
    expect(shouldCheckVersion(now - VERSION_CHECK_MIN_INTERVAL_MS + 1, now)).toBe(false);
    expect(shouldCheckVersion(now - VERSION_CHECK_MIN_INTERVAL_MS, now)).toBe(true);
    expect(shouldCheckVersion(now - 1000, now, 500)).toBe(true);
  });

  it("waits when the clock moved backwards", () => {
    expect(shouldCheckVersion(now + 10_000, now)).toBe(false);
  });
});

describe("navigationKey", () => {
  it("ignores the origin and hash", () => {
    expect(navigationKey(new URL("https://app.example/campaigns?x=1#top"))).toBe("/campaigns?x=1");
  });
});

describe("clientNavigationTarget", () => {
  const base: LinkClick = {
    href: "https://app.example/campaigns",
    currentHref: "https://app.example/dashboard",
    button: 0,
    modifierKey: false,
    target: null,
    download: false,
  };

  it("returns the target of a same-origin link to another page", () => {
    expect(clientNavigationTarget(base)).toBe("/campaigns");
    expect(clientNavigationTarget({ ...base, target: "_self" })).toBe("/campaigns");
    expect(clientNavigationTarget({ ...base, href: "https://app.example/dashboard?range=7d" })).toBe(
      "/dashboard?range=7d",
    );
  });

  it("ignores clicks that do not start a client navigation", () => {
    expect(clientNavigationTarget({ ...base, button: 1 })).toBeNull();
    expect(clientNavigationTarget({ ...base, modifierKey: true })).toBeNull();
    expect(clientNavigationTarget({ ...base, target: "_blank" })).toBeNull();
    expect(clientNavigationTarget({ ...base, download: true })).toBeNull();
    expect(clientNavigationTarget({ ...base, href: "https://other.example/campaigns" })).toBeNull();
    expect(clientNavigationTarget({ ...base, href: "mailto:hi@example.com" })).toBeNull();
    expect(clientNavigationTarget({ ...base, href: "https://app.example/dashboard#chart" })).toBeNull();
    expect(clientNavigationTarget({ ...base, href: "not a url" })).toBeNull();
  });
});
