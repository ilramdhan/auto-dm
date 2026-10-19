import { describe, expect, it } from "vitest";
import type { Campaign, Rule } from "@/server/db/schema";
import {
  PRIVATE_REPLY_WINDOW_MS,
  isWithinPrivateReplyWindow,
  manualKeyword,
  manualRuleCandidates,
  manualSendBlocker,
  preselectRuleId,
  previewSend,
} from "./manual";
import { ANY_KEYWORD } from "./match";

const t0 = new Date("2026-10-19T12:00:00Z");
const campaign = (id: string, mediaId: string | null): Campaign => ({
  id,
  accountId: null,
  name: `Campaign ${id}`,
  description: null,
  mediaId,
  mediaPermalink: null,
  mediaThumbnailUrl: null,
  mediaCaption: null,
  isActive: true,
  startsAt: null,
  endsAt: null,
  createdAt: t0,
  updatedAt: t0,
});
const rule = (id: string, campaignId: string, keywords: string[], over: Partial<Rule> = {}): Rule => ({
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
  priority: 0,
  isActive: true,
  createdAt: t0,
  updatedAt: t0,
  ...over,
});

describe("isWithinPrivateReplyWindow", () => {
  it("allows comments younger than 7 days", () => {
    expect(isWithinPrivateReplyWindow(new Date(t0.getTime() - 1000), t0)).toBe(true);
    expect(isWithinPrivateReplyWindow(new Date(t0.getTime() - PRIVATE_REPLY_WINDOW_MS + 1), t0)).toBe(true);
  });
  it("refuses comments exactly 7 days old or older", () => {
    expect(isWithinPrivateReplyWindow(new Date(t0.getTime() - PRIVATE_REPLY_WINDOW_MS), t0)).toBe(false);
    expect(isWithinPrivateReplyWindow(new Date("2026-10-01T00:00:00Z"), t0)).toBe(false);
  });
  it("refuses invalid dates", () => {
    expect(isWithinPrivateReplyWindow(new Date("nope"), t0)).toBe(false);
  });
});

describe("manualSendBlocker", () => {
  const fresh = new Date(t0.getTime() - 3600_000);
  it("allows a recent skipped row", () => {
    expect(manualSendBlocker({ status: "skipped", skipReason: "no_match", createdAt: fresh }, t0)).toBeNull();
  });
  it("refuses rows that are not skipped, own comments, other accounts and old comments", () => {
    expect(manualSendBlocker({ status: "sent", skipReason: null, createdAt: fresh }, t0)).toMatch(/handled/);
    expect(manualSendBlocker({ status: "skipped", skipReason: "own_comment", createdAt: fresh }, t0)).toMatch(
      /never answered/,
    );
    expect(
      manualSendBlocker({ status: "skipped", skipReason: "account_mismatch", createdAt: fresh }, t0),
    ).toMatch(/never answered/);
    expect(
      manualSendBlocker({ status: "skipped", skipReason: "no_match", createdAt: new Date("2026-10-01") }, t0),
    ).toMatch(/7 days/);
  });
});

describe("manualRuleCandidates / preselectRuleId", () => {
  const all = campaign("all", null);
  const post = campaign("post", "m1");
  const organic = campaign("organic", "m-organic");
  const active = [
    { campaign: all, rules: [rule("r-all", "all", ["ebook"])] },
    {
      campaign: post,
      rules: [rule("r-post", "post", ["drive"]), rule("r-any", "post", [], { matchMode: "any" })],
    },
    { campaign: organic, rules: [rule("r-craft", "organic", ["craft"])] },
  ];
  const row = (
    over: Partial<{
      mediaId: string | null;
      skipReason: string | null;
      ruleId: string | null;
      commentText: string | null;
    }>,
  ) => ({
    mediaId: "m1",
    skipReason: "no_match",
    ruleId: null,
    commentText: "hello",
    ...over,
  });

  it("offers the post's rules then 'all posts' rules, not other posts' rules", () => {
    expect(manualRuleCandidates(active, row({})).map((c) => c.rule.id)).toEqual(["r-post", "r-any", "r-all"]);
  });

  it("offers the other post's rule first for no_campaign_for_post rows", () => {
    const d = row({
      mediaId: "m-ad",
      skipReason: "no_campaign_for_post",
      ruleId: "r-craft",
      commentText: "craft",
    });
    expect(manualRuleCandidates(active, d).map((c) => c.rule.id)).toEqual(["r-craft", "r-all"]);
    expect(preselectRuleId(d, active)).toBe("r-craft");
  });

  it("pre-selects the rule that matches now, keyword rules beating `any`", () => {
    expect(preselectRuleId(row({ commentText: "DRIVE pls" }), active)).toBe("r-post");
    expect(preselectRuleId(row({ commentText: "nice" }), active)).toBe("r-any");
    expect(preselectRuleId(row({ commentText: "nice" }), active, { isReply: true })).toBeNull();
    expect(preselectRuleId(row({ mediaId: "m9", commentText: "ebook" }), active)).toBe("r-all");
    expect(preselectRuleId(row({ mediaId: "m9", commentText: "nothing" }), active)).toBeNull();
    expect(preselectRuleId(row({ commentText: null }), active)).toBeNull();
  });

  it("falls back to matching when the stored other-post rule is gone", () => {
    const d = row({
      mediaId: "m1",
      skipReason: "no_campaign_for_post",
      ruleId: "deleted",
      commentText: "drive",
    });
    expect(preselectRuleId(d, active)).toBe("r-post");
  });
});

describe("manualKeyword", () => {
  it("uses the keyword found in the text now", () => {
    expect(manualKeyword("pls DRIVE", rule("r", "c", ["link", "drive"]))).toBe("drive");
  });
  it("records '*' when nothing matches, for `any` rules and without text", () => {
    expect(manualKeyword("hello", rule("r", "c", ["drive"]))).toBe(ANY_KEYWORD);
    expect(manualKeyword("drive", rule("r", "c", [], { matchMode: "any" }))).toBe(ANY_KEYWORD);
    expect(manualKeyword(null, rule("r", "c", ["drive"]))).toBe(ANY_KEYWORD);
  });
  it("ignores the rule's active flag (the operator chose it)", () => {
    expect(manualKeyword("drive", rule("r", "c", ["drive"], { isActive: false }))).toBe("drive");
  });
});

describe("previewSend", () => {
  const limits = { commentMax: 2200, dmMax: 1000 };
  it("renders every reply variant, the DM and the button", () => {
    const p = previewSend(
      {
        publicReplies: ["Check DM @{username}", "  ", "Sent {keyword}!"],
        dmMessage: "Hi {username}, here's {keyword}",
        dmButtonTitle: "Open",
        dmButtonUrl: "https://example.com",
      },
      { username: "alice", keyword: "drive" },
      limits,
    );
    expect(p).toEqual({
      publicReplies: ["Check DM @alice", "Sent drive!"],
      dm: "Hi alice, here's drive",
      button: { title: "Open", url: "https://example.com" },
    });
  });
  it("renders {keyword} empty for '*' and truncates the DM", () => {
    const p = previewSend(
      {
        publicReplies: [],
        dmMessage: `Got {keyword} ${"x".repeat(20)}`,
        dmButtonTitle: null,
        dmButtonUrl: null,
      },
      { username: null, keyword: ANY_KEYWORD },
      { commentMax: 10, dmMax: 10 },
    );
    expect(p.publicReplies).toEqual([]);
    expect(Array.from(p.dm)).toHaveLength(10);
    expect(p.dm.startsWith("Got x")).toBe(true);
    expect(p.button).toBeNull();
  });
});
