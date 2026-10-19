import { describe, expect, it } from "vitest";
import type { Campaign, Rule } from "@/server/db/schema";
import { campaignsForMedia, pickMatch, pickOtherPostMatch } from "./pick";

const now = new Date();
const campaign = (id: string, mediaId: string | null): Campaign => ({
  id,
  accountId: null,
  name: id,
  description: null,
  mediaId,
  mediaPermalink: null,
  mediaThumbnailUrl: null,
  mediaCaption: null,
  isActive: true,
  startsAt: null,
  endsAt: null,
  createdAt: now,
  updatedAt: now,
});
const rule = (
  id: string,
  campaignId: string,
  keywords: string[],
  priority = 0,
  matchMode: Rule["matchMode"] = "word",
): Rule => ({
  id,
  campaignId,
  name: id,
  keywords,
  matchMode,
  publicReplies: [],
  dmMessage: "dm",
  dmButtonTitle: null,
  dmButtonUrl: null,
  oncePerUser: true,
  priority,
  isActive: true,
  createdAt: now,
  updatedAt: now,
});

describe("pickMatch", () => {
  const all = campaign("all", null);
  const post = campaign("post", "m1");

  it("prefers media-specific campaigns over 'all posts' even with lower priority", () => {
    const res = pickMatch("drive", [
      { campaign: all, rules: [rule("r-all", "all", ["drive"], 100)] },
      { campaign: post, rules: [rule("r-post", "post", ["drive"], 0)] },
    ]);
    expect(res?.rule.id).toBe("r-post");
    expect(res?.campaign.id).toBe("post");
    expect(res?.keyword).toBe("drive");
    expect(res?.rule).not.toHaveProperty("campaign");
  });

  it("falls back to 'all posts' when the media campaign has no matching rule", () => {
    const res = pickMatch("ebook", [
      { campaign: post, rules: [rule("r-post", "post", ["drive"])] },
      { campaign: all, rules: [rule("r-all", "all", ["ebook"])] },
    ]);
    expect(res?.rule.id).toBe("r-all");
  });

  it("uses priority across campaigns in the same tier", () => {
    const post2 = campaign("post2", "m1");
    const res = pickMatch("drive", [
      { campaign: post, rules: [rule("a", "post", ["drive"], 1)] },
      { campaign: post2, rules: [rule("b", "post2", ["drive"], 5)] },
    ]);
    expect(res?.rule.id).toBe("b");
  });

  it("returns null without matches", () => {
    expect(pickMatch("hello", [{ campaign: all, rules: [rule("r", "all", ["drive"])] }])).toBeNull();
    expect(pickMatch("hello", [])).toBeNull();
  });

  it("a media-specific any rule beats an 'all posts' keyword rule (tiers come first)", () => {
    const res = pickMatch("drive", [
      { campaign: all, rules: [rule("r-all", "all", ["drive"], 100)] },
      { campaign: post, rules: [rule("r-any", "post", [], 0, "any")] },
    ]);
    expect(res?.rule.id).toBe("r-any");
    expect(res?.keyword).toBe("*");
  });

  it("within a tier, keyword rules beat any rules across campaigns", () => {
    const all2 = campaign("all2", null);
    const res = pickMatch("drive", [
      { campaign: all, rules: [rule("r-any", "all", [], 50, "any")] },
      { campaign: all2, rules: [rule("r-kw", "all2", ["drive"])] },
    ]);
    expect(res?.rule.id).toBe("r-kw");
  });

  it("falls through to an 'all posts' keyword rule for thread replies", () => {
    const opts = { isReply: true };
    const applicable = [
      { campaign: post, rules: [rule("r-any", "post", [], 0, "any")] },
      { campaign: all, rules: [rule("r-all", "all", ["drive"])] },
    ];
    expect(pickMatch("drive", applicable, opts)?.rule.id).toBe("r-all");
    expect(pickMatch("thanks kak", applicable, opts)).toBeNull();
  });
});

describe("campaignsForMedia", () => {
  const all = { campaign: campaign("all", null), rules: [] };
  const p1 = { campaign: campaign("p1", "m1"), rules: [] };
  const p2 = { campaign: campaign("p2", "m2"), rules: [] };

  it("keeps the post's campaigns and 'all posts', post-specific first", () => {
    expect(campaignsForMedia([all, p1, p2], "m1").map((c) => c.campaign.id)).toEqual(["p1", "all"]);
  });
  it("null media id keeps only 'all posts'; undefined keeps everything", () => {
    expect(campaignsForMedia([all, p1, p2], null).map((c) => c.campaign.id)).toEqual(["all"]);
    expect(campaignsForMedia([all, p1, p2], undefined).map((c) => c.campaign.id)).toEqual([
      "p1",
      "p2",
      "all",
    ]);
  });
});

describe("pickOtherPostMatch (no_campaign_for_post)", () => {
  const organic = campaign("organic", "m-organic");
  const here = campaign("here", "m-ad");
  const all = campaign("all", null);

  it("finds a keyword rule of a campaign for a different post (boosted reel's ad id)", () => {
    const res = pickOtherPostMatch(
      "CRAFT 🙏",
      [{ campaign: organic, rules: [rule("r-craft", "organic", ["craft"])] }],
      "m-ad",
    );
    expect(res).toMatchObject({ campaign: { id: "organic" }, rule: { id: "r-craft" }, keyword: "craft" });
  });

  it("ignores campaigns for this post, 'all posts' campaigns and `any` rules", () => {
    const res = pickOtherPostMatch(
      "craft",
      [
        { campaign: here, rules: [rule("r-here", "here", ["craft"])] },
        { campaign: all, rules: [rule("r-all", "all", ["craft"])] },
        { campaign: organic, rules: [rule("r-any", "organic", [], 0, "any")] },
      ],
      "m-ad",
    );
    expect(res).toBeNull();
  });

  it("returns null when the text matches nothing", () => {
    expect(
      pickOtherPostMatch(
        "menarik",
        [{ campaign: organic, rules: [rule("r", "organic", ["craft"])] }],
        "m-ad",
      ),
    ).toBeNull();
  });

  it("follows priority across campaigns", () => {
    const other = campaign("other", "m-other");
    const res = pickOtherPostMatch(
      "craft",
      [
        { campaign: organic, rules: [rule("low", "organic", ["craft"], 0)] },
        { campaign: other, rules: [rule("high", "other", ["craft"], 5)] },
      ],
      null,
    );
    expect(res?.rule.id).toBe("high");
  });
});
