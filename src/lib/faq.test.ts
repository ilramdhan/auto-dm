import { describe, expect, it } from "vitest";
import { FAQ_GROUPS, faqJsonLd, findFaqItems, HOME_FAQ_IDS } from "./faq";

describe("FAQ content", () => {
  const items = FAQ_GROUPS.flatMap((g) => g.items);

  it("uses unique ids (they are page anchors)", () => {
    const ids = [...FAQ_GROUPS.map((g) => g.id), ...items.map((i) => i.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("covers the own-account and tester pitfall", () => {
    const item = items.find((i) => i.id === "test-comment-did-nothing");
    expect(item?.answer.join(" ")).toMatch(/own connected account/);
    expect(item?.answer.join(" ")).toMatch(/Instagram Tester/);
  });

  it("only links to site pages or https URLs", () => {
    for (const item of items) {
      if (item.link) expect(item.link.href).toMatch(/^(\/|https:\/\/)/);
    }
  });
});

describe("findFaqItems", () => {
  it("returns the home page questions in order and ignores unknown ids", () => {
    expect(findFaqItems(HOME_FAQ_IDS).map((i) => i.id)).toEqual([...HOME_FAQ_IDS]);
    expect(findFaqItems(["nope"])).toEqual([]);
  });
});

describe("faqJsonLd", () => {
  it("lists every question with its answer text", () => {
    const ld = faqJsonLd();
    const count = FAQ_GROUPS.reduce((n, g) => n + g.items.length, 0);
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(count);
    expect(ld.mainEntity[0]).toMatchObject({
      "@type": "Question",
      acceptedAnswer: { "@type": "Answer", text: expect.any(String) },
    });
  });
});
