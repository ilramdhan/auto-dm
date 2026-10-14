import { describe, expect, it } from "vitest";
import { changePasswordSchema, forcedChangePasswordSchema, loginSchema, passwordStrength } from "./auth";
import { campaignSchema } from "./campaign";
import { ruleSchema, splitKeywords } from "./rule";
import { activityFiltersSchema } from "./activity";
import { metaAppSchema } from "./settings";

const baseRule = {
  name: "Guide",
  keywords: ["guide"],
  matchMode: "word",
  publicReplies: ["Check your DMs {username}"],
  dmMessage: "Here you go",
  dmButtonTitle: "",
  dmButtonUrl: "",
  oncePerUser: true,
  priority: 0,
  isActive: true,
} as const;

describe("ruleSchema", () => {
  it("accepts a valid rule and normalizes optional fields", () => {
    const r = ruleSchema.parse({
      ...baseRule,
      keywords: [" Guide ", "guide", "LINK"],
      publicReplies: ["a", "", "b"],
    });
    expect(r.keywords).toEqual(["Guide", "LINK"]);
    expect(r.publicReplies).toEqual(["a", "b"]);
    expect(r.dmButtonTitle).toBeNull();
    expect(r.dmButtonUrl).toBeNull();
  });
  it("requires at least one keyword and a DM", () => {
    const res = ruleSchema.safeParse({ ...baseRule, keywords: [], dmMessage: " " });
    expect(res.success).toBe(false);
    const paths = res.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("keywords");
    expect(paths).toContain("dmMessage");
  });
  it("enforces the 1000-char DM limit", () => {
    expect(ruleSchema.safeParse({ ...baseRule, dmMessage: "x".repeat(1000) }).success).toBe(true);
    expect(ruleSchema.safeParse({ ...baseRule, dmMessage: "x".repeat(1001) }).success).toBe(false);
  });
  it("requires button title and URL together, http(s) only", () => {
    expect(ruleSchema.safeParse({ ...baseRule, dmButtonTitle: "Open" }).success).toBe(false);
    expect(
      ruleSchema.safeParse({ ...baseRule, dmButtonTitle: "Open", dmButtonUrl: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(
      ruleSchema.safeParse({ ...baseRule, dmButtonTitle: "Open", dmButtonUrl: "https://example.com" })
        .success,
    ).toBe(true);
  });
  it("coerces priority", () => {
    expect(ruleSchema.parse({ ...baseRule, priority: "5" }).priority).toBe(5);
  });
});

describe("splitKeywords", () => {
  it("splits on commas and newlines", () => {
    expect(splitKeywords("a, b,,\n c ")).toEqual(["a", "b", "c"]);
  });
});

describe("campaignSchema", () => {
  const base = {
    name: "Promo",
    description: "",
    target: "all",
    isActive: true,
    startsAt: "",
    endsAt: "",
  } as const;
  it("accepts an all-posts campaign without media", () => {
    const c = campaignSchema.parse(base);
    expect(c.startsAt).toBeNull();
  });
  it("requires media when targeting a post", () => {
    const res = campaignSchema.safeParse({ ...base, target: "media" });
    expect(res.success).toBe(false);
    expect(res.error!.issues[0]!.path).toEqual(["mediaId"]);
  });
  it("rejects an end before the start", () => {
    const res = campaignSchema.safeParse({
      ...base,
      startsAt: "2026-10-10T10:00:00.000Z",
      endsAt: "2026-10-09T10:00:00.000Z",
    });
    expect(res.success).toBe(false);
    expect(res.error!.issues[0]!.path).toEqual(["endsAt"]);
  });
  it("parses ISO dates", () => {
    const c = campaignSchema.parse({ ...base, startsAt: "2026-10-10T10:00:00.000Z" });
    expect(c.startsAt).toBeInstanceOf(Date);
  });
});

describe("auth schemas", () => {
  it("login requires both fields", () => {
    expect(loginSchema.safeParse({ username: "", password: "" }).success).toBe(false);
  });
  it("forced change requires 12+ chars and matching confirmation", () => {
    expect(forcedChangePasswordSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(false);
    expect(
      forcedChangePasswordSchema.safeParse({ password: "long-enough-pass", confirm: "different-pass!" })
        .success,
    ).toBe(false);
    expect(
      forcedChangePasswordSchema.safeParse({ password: "long-enough-pass", confirm: "long-enough-pass" })
        .success,
    ).toBe(true);
  });
  it("voluntary change must differ from the current password", () => {
    const res = changePasswordSchema.safeParse({
      current: "long-enough-pass",
      password: "long-enough-pass",
      confirm: "long-enough-pass",
    });
    expect(res.success).toBe(false);
  });
  it("strength meter ranks passwords", () => {
    expect(passwordStrength("changeme123").score).toBeLessThanOrEqual(1);
    expect(passwordStrength("Correct-Horse-Battery-9").score).toBeGreaterThanOrEqual(3);
  });
});

describe("activityFiltersSchema", () => {
  it("falls back on invalid values instead of throwing", () => {
    const f = activityFiltersSchema.parse({ status: "bogus", campaign: "nope", page: "-3" });
    expect(f).toMatchObject({ status: undefined, campaign: undefined, page: 1 });
  });
});

describe("metaAppSchema", () => {
  it("allows a blank secret (keep stored) but validates a provided one", () => {
    expect(metaAppSchema.safeParse({ appId: "123456789", appSecret: "" }).success).toBe(true);
    expect(metaAppSchema.safeParse({ appId: "123456789", appSecret: "short" }).success).toBe(false);
    expect(metaAppSchema.safeParse({ appId: "abc" }).success).toBe(false);
  });
});
