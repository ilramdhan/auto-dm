import { describe, expect, it } from "vitest";
import { compareSemver, isUpdateAvailable, parseSemver, stripV } from "./semver";

describe("compareSemver", () => {
  it("treats equal versions (with or without v) as equal", () => {
    expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
    expect(compareSemver("v1.2.3", "1.2.3")).toBe(0);
    expect(compareSemver("1.2.3+build.5", "1.2.3")).toBe(0);
  });

  it("orders major, minor and patch numerically", () => {
    expect(compareSemver("1.0.0", "2.0.0")).toBe(-1);
    expect(compareSemver("2.0.0", "1.99.99")).toBe(1);
    expect(compareSemver("0.3.0", "0.10.0")).toBe(-1);
    expect(compareSemver("0.3.9", "0.3.10")).toBe(-1);
    expect(compareSemver("0.3.1", "0.3.0")).toBe(1);
  });

  it("ranks prereleases below the release and orders their identifiers", () => {
    expect(compareSemver("1.0.0-rc.1", "1.0.0")).toBe(-1);
    expect(compareSemver("1.0.0", "1.0.0-rc.1")).toBe(1);
    expect(compareSemver("1.0.0-alpha", "1.0.0-alpha.1")).toBe(-1);
    expect(compareSemver("1.0.0-alpha.1", "1.0.0-alpha.beta")).toBe(-1);
    expect(compareSemver("1.0.0-beta.2", "1.0.0-beta.11")).toBe(-1);
    expect(compareSemver("1.0.0-beta", "1.0.0-rc.1")).toBe(-1);
    expect(compareSemver("1.0.0-rc.1", "1.0.0-rc.1")).toBe(0);
    expect(compareSemver("1.0.0-rc.1", "0.9.0")).toBe(1);
  });

  it("returns null for malformed input", () => {
    for (const bad of ["", "1", "1.2", "1.2.3.4", "01.2.3", "latest", "v", "1.2.x", "1.2.3-"]) {
      expect(compareSemver(bad, "1.0.0")).toBeNull();
      expect(compareSemver("1.0.0", bad)).toBeNull();
      expect(parseSemver(bad)).toBeNull();
    }
  });
});

describe("isUpdateAvailable", () => {
  it("is true only for a strictly newer tag", () => {
    expect(isUpdateAvailable("0.3.0", "v0.4.0")).toBe(true);
    expect(isUpdateAvailable("0.3.0", "v0.3.1")).toBe(true);
    expect(isUpdateAvailable("0.3.0", "v1.0.0")).toBe(true);
    expect(isUpdateAvailable("0.3.0", "v0.3.0")).toBe(false);
    expect(isUpdateAvailable("0.4.0", "v0.3.0")).toBe(false);
    expect(isUpdateAvailable("1.0.0-rc.1", "v1.0.0")).toBe(true);
    expect(isUpdateAvailable("1.0.0", "v1.0.0-rc.2")).toBe(false);
  });

  it("is false when either side is malformed", () => {
    expect(isUpdateAvailable("0.3.0", "nightly")).toBe(false);
    expect(isUpdateAvailable("dev", "v9.9.9")).toBe(false);
    expect(isUpdateAvailable("0.3.0", "")).toBe(false);
  });
});

describe("stripV", () => {
  it("drops a leading v before a digit only", () => {
    expect(stripV("v1.2.3")).toBe("1.2.3");
    expect(stripV("1.2.3")).toBe("1.2.3");
    expect(stripV("version")).toBe("version");
  });
});
