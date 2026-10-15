import { describe, expect, it } from "vitest";
import { REPO_URL } from "./constants";
import { docUrl, FOOTER_COLUMNS, isCurrentPath, MAIN_NAV } from "./site-nav";
import { PUBLIC_PATHS } from "./seo";

describe("docUrl", () => {
  it("points at the docs folder on the main branch, with an optional anchor", () => {
    expect(docUrl("meta-setup.md")).toBe(`${REPO_URL}/blob/main/docs/meta-setup.md`);
    expect(docUrl("meta-setup.md", "part-8")).toBe(`${REPO_URL}/blob/main/docs/meta-setup.md#part-8`);
    expect(docUrl("meta-setup.md", "#part-8")).toBe(`${REPO_URL}/blob/main/docs/meta-setup.md#part-8`);
  });
});

describe("isCurrentPath", () => {
  it("matches the page and its children only", () => {
    expect(isCurrentPath("/features", "/features")).toBe(true);
    expect(isCurrentPath("/features/", "/features")).toBe(true);
    expect(isCurrentPath("/setup/docker", "/setup")).toBe(true);
    expect(isCurrentPath("/setupx", "/setup")).toBe(false);
    expect(isCurrentPath("/faq", "/features")).toBe(false);
  });

  it("treats home, anchors and external links specially", () => {
    expect(isCurrentPath("/", "/")).toBe(true);
    expect(isCurrentPath("/faq", "/")).toBe(false);
    expect(isCurrentPath("/", "/#how-it-works")).toBe(false);
    expect(isCurrentPath("/", "https://github.com")).toBe(false);
  });
});

describe("navigation config", () => {
  const all = [...MAIN_NAV, ...FOOTER_COLUMNS.flatMap((c) => c.links)];

  it("only links internally to public pages (or the sign-in page)", () => {
    const allowed = new Set<string>([...PUBLIC_PATHS, "/login"]);
    for (const link of all.filter((l) => !l.external)) {
      expect(allowed.has(link.href.split("#")[0]!), link.href).toBe(true);
    }
  });

  it("uses https for external links", () => {
    for (const link of all.filter((l) => l.external)) expect(link.href).toMatch(/^https:\/\//);
  });

  it("has no duplicate links inside a column", () => {
    for (const col of FOOTER_COLUMNS) {
      const hrefs = col.links.map((l) => l.href);
      expect(new Set(hrefs).size, col.title).toBe(hrefs.length);
    }
  });
});
