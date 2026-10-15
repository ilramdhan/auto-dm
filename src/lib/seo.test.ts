import { describe, expect, it } from "vitest";
import { absoluteUrl, jsonLdScript, publicPageMetadata } from "./seo";

describe("absoluteUrl", () => {
  it("joins the base and path, or keeps the path when the base is unknown", () => {
    expect(absoluteUrl("https://a.example", "/")).toBe("https://a.example/");
    expect(absoluteUrl("https://a.example", "/privacy")).toBe("https://a.example/privacy");
    expect(absoluteUrl(null, "/terms")).toBe("/terms");
  });
});

describe("jsonLdScript", () => {
  it("escapes characters that could break out of the script element", () => {
    const data = { name: "</script><script>alert(1)</script><!--" };
    const out = jsonLdScript(data);
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual(data);
  });
});

describe("publicPageMetadata", () => {
  it("sets the canonical path and matching social titles", () => {
    const m = publicPageMetadata({ title: "Privacy policy", path: "/privacy" });
    expect(m.alternates?.canonical).toBe("/privacy");
    expect(m.title).toBe("Privacy policy");
    expect(m.openGraph?.url).toBe("/privacy");
    expect(m.openGraph?.images).toEqual([expect.objectContaining({ url: "/opengraph-image", width: 1200 })]);
    expect(m.twitter).toMatchObject({ card: "summary_large_image", title: "Privacy policy" });
    expect(publicPageMetadata({ title: "Home", path: "/", absoluteTitle: true }).title).toEqual({
      absolute: "Home",
    });
  });
});
