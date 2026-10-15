import { describe, expect, it } from "vitest";
import { isAllowedLink, parseInline, parseReleaseNotes, stripTags } from "./release-notes";

// Shaped like a release-please body (fake repo, fake hashes).
const FIXTURE = `## [0.4.0](https://github.com/example/app/compare/v0.3.0...v0.4.0) (2026-10-20)


### Features

* **settings:** show app version and update check ([#50](https://github.com/example/app/issues/50)) ([abc1234](https://github.com/example/app/commit/abc1234def)), closes [#49](https://github.com/example/app/issues/49)
* privacy policy page ([#43](https://github.com/example/app/issues/43)) ([c296db2](https://github.com/example/app/commit/c296db2aa))


### Bug Fixes

* **migrate:** adopt migrations run by hand ([#39](https://github.com/example/app/issues/39)) ([9c78393](https://github.com/example/app/commit/9c78393bb))
* keep \`APP_URL\` without a trailing slash
  when building redirect URIs ([#41](https://github.com/example/app/issues/41))
`;

describe("parseReleaseNotes", () => {
  it("turns a release-please body into sections and items", () => {
    const notes = parseReleaseNotes(FIXTURE);
    expect(notes.truncated).toBe(false);
    expect(notes.sections.map((s) => s.title)).toEqual(["Features", "Bug Fixes"]);

    const [features, fixes] = notes.sections;
    expect(features?.items).toEqual([
      {
        text: "settings: show app version and update check",
        links: [
          { label: "#50", href: "https://github.com/example/app/issues/50" },
          { label: "abc1234", href: "https://github.com/example/app/commit/abc1234def" },
          { label: "#49", href: "https://github.com/example/app/issues/49" },
        ],
      },
      {
        text: "privacy policy page",
        links: [
          { label: "#43", href: "https://github.com/example/app/issues/43" },
          { label: "c296db2", href: "https://github.com/example/app/commit/c296db2aa" },
        ],
      },
    ]);
    expect(fixes?.items[0]?.text).toBe("migrate: adopt migrations run by hand");
    // indented continuation lines join the bullet; inline code markers are stripped
    expect(fixes?.items[1]).toEqual({
      text: "keep APP_URL without a trailing slash when building redirect URIs",
      links: [{ label: "#41", href: "https://github.com/example/app/issues/41" }],
    });
  });

  it("drops the version heading and handles empty bodies", () => {
    expect(parseReleaseNotes("").sections).toEqual([]);
    expect(parseReleaseNotes(null).sections).toEqual([]);
    expect(
      parseReleaseNotes("## [1.0.0](https://github.com/x/y/compare/a...b) (2026-01-01)\n").sections,
    ).toEqual([]);
  });

  it("puts bullets without a heading into an untitled section", () => {
    const notes = parseReleaseNotes("* one\n- two\n\nplain line");
    expect(notes.sections).toEqual([
      {
        title: null,
        items: [
          { text: "one", links: [] },
          { text: "two", links: [] },
          { text: "plain line", links: [] },
        ],
      },
    ]);
  });

  it("never keeps non-GitHub or non-https links, and drops raw HTML", () => {
    const notes = parseReleaseNotes(
      "### Notes\n* see [docs](http://github.com/x) [evil](https://evil.example/x) [js](javascript:alert(1)) [ok](https://github.com/x/y/pull/1) <img src=x onerror=alert(1)>done",
    );
    const item = notes.sections[0]?.items[0];
    expect(item?.links).toEqual([{ label: "ok", href: "https://github.com/x/y/pull/1" }]);
    expect(item?.text).not.toMatch(/<|evil|javascript/);
    expect(item?.text).toContain("done");
  });

  it("caps very long bodies", () => {
    const body = `### Big\n${Array.from({ length: 40 }, (_, i) => `* item ${i}`).join("\n")}`;
    const notes = parseReleaseNotes(body);
    expect(notes.sections[0]?.items).toHaveLength(15);
    expect(notes.truncated).toBe(true);
  });

  it("ignores fenced code blocks", () => {
    const notes = parseReleaseNotes("### A\n```\n* not an item\n```\n* real");
    expect(notes.sections[0]?.items).toEqual([{ text: "real", links: [] }]);
  });
});

describe("parseInline / isAllowedLink", () => {
  it("cleans release-please scaffolding", () => {
    expect(
      parseInline(
        "fix it ([#1](https://github.com/a/b/issues/1)), closes [#2](https://github.com/a/b/issues/2)",
      ).text,
    ).toBe("fix it");
  });

  it("accepts only https://github.com/ URLs", () => {
    expect(isAllowedLink("https://github.com/a/b")).toBe(true);
    expect(isAllowedLink("https://github.com.evil.example/a")).toBe(false);
    expect(isAllowedLink("https://gist.github.com/a")).toBe(false);
    expect(isAllowedLink("http://github.com/a")).toBe(false);
    expect(isAllowedLink("https://github.com@evil.example/")).toBe(false);
  });

  it("never leaves angle brackets behind, even for nested tags", () => {
    const item = parseInline("fix <<script>script>alert(1)<</script>/script> done");
    expect(item.text).not.toMatch(/[<>]|script/);
    expect(stripTags("a <b>bold</b> c")).toBe("a bold c");
    expect(stripTags("x > y")).toBe("x  y");
  });
});
