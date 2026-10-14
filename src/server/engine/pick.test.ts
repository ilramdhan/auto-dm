import { describe, expect, it } from "vitest";
import type { Campaign, Rule } from "@/server/db/schema";
import { pickMatch } from "./pick";

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
const rule = (id: string, campaignId: string, keywords: string[], priority = 0): Rule => ({
  id,
  campaignId,
  name: id,
  keywords,
  matchMode: "word",
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
});
