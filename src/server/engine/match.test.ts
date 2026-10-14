import { describe, expect, it } from "vitest";
import { keywordMatches, matchComment, type MatchableRule } from "./match";
import { normalizeText } from "./normalize";

type R = MatchableRule & { id: string };
const rule = (id: string, keywords: string[], extra: Partial<R> = {}): R => ({ id, keywords, ...extra });

describe("normalizeText", () => {
  it.each([
    ["DRIVE 🙏", "drive"],
    ["drive!!", "drive"],
    ["  Drive  ", "drive"],
    ["Café crème", "cafe creme"],
    ["𝐃𝐑𝐈𝐕𝐄", "drive"],
    ["ＤＲＩＶＥ", "drive"],
    ["Straße", "strasse"],
    ["e-book, please", "e book please"],
    ["🔥🔥🔥", ""],
    ["Mau dong kak 😍😍", "mau dong kak"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeText(input)).toBe(expected);
  });
});

describe("keywordMatches — word mode (default)", () => {
  it.each([
    "drive",
    "Drive",
    "DRIVE 🙏",
    "drive!!",
    "pls drive",
    "Drive please 🙏🙏",
    "@creator drive",
    "#drive",
    "drive.",
    "(drive)",
    "DRÍVE",
    "send me the drive link",
    "drive\nthanks",
  ])("matches %j", (text) => {
    expect(keywordMatches(text, "drive")).toBe(true);
  });

  it.each(["driver", "overdrive", "googledrive", "dr ive", "", "🙏"])("does not match %j", (text) => {
    expect(keywordMatches(text, "drive")).toBe(false);
  });

  it("matches multi-word phrases as a whole", () => {
    expect(keywordMatches("I want the FREE   guide!!", "free guide")).toBe(true);
    expect(keywordMatches("free stuff guide", "free guide")).toBe(false);
  });

  it("treats keyword punctuation like comment punctuation", () => {
    expect(keywordMatches("send the ebook", "e-book")).toBe(false);
    expect(keywordMatches("send the e book", "e-book")).toBe(true);
    expect(keywordMatches("send the E-Book pls", "e-book")).toBe(true);
  });

  it("is diacritic-insensitive in both directions", () => {
    expect(keywordMatches("cafe", "café")).toBe(true);
    expect(keywordMatches("CAFÉ!", "cafe")).toBe(true);
  });
});

describe("keywordMatches — Indonesian comments", () => {
  it.each([
    ["Mau dong kak 🙏", "mau"],
    ["MAU!!!", "mau"],
    ["mau link nya kak", "link"],
    ["Kak, minta LINK-nya dong 😍", "link"],
    ["info harga kak", "harga"],
    ["Berapa harganya?", "harganya"],
    ["Saya mau ikut kelas", "ikut kelas"],
  ])("%j matches %j", (text, kw) => {
    expect(keywordMatches(text, kw)).toBe(true);
  });

  it("does not match a word prefix", () => {
    expect(keywordMatches("Berapa harganya?", "harga")).toBe(false);
    expect(keywordMatches("Berapa harganya?", "harga", "contains")).toBe(true);
  });
});

describe("keywordMatches — exact mode", () => {
  it.each(["drive", "Drive!", "DRIVE 🙏", "  drive...  ", "@brand drive", "drive @brand"])(
    "matches %j",
    (text) => {
      expect(keywordMatches(text, "drive", "exact")).toBe(true);
    },
  );
  it.each(["drive please", "the drive", "drives"])("does not match %j", (text) => {
    expect(keywordMatches(text, "drive", "exact")).toBe(false);
  });
  it("supports phrases", () => {
    expect(keywordMatches("Free Guide!!", "free guide", "exact")).toBe(true);
  });
});

describe("keywordMatches — contains mode", () => {
  it("matches substrings", () => {
    expect(keywordMatches("googledrive", "drive", "contains")).toBe(true);
    expect(keywordMatches("OVERDRIVE!!", "drive", "contains")).toBe(true);
    expect(keywordMatches("dr ive", "drive", "contains")).toBe(false);
  });
});

describe("keywordMatches — emoji keywords", () => {
  it("matches emoji-only keywords", () => {
    expect(keywordMatches("🔥", "🔥")).toBe(true);
    expect(keywordMatches("so good 🔥🔥", "🔥")).toBe(true);
    expect(keywordMatches("🔥️", "🔥")).toBe(true); // variation selector
    expect(keywordMatches("👍🏽", "👍")).toBe(true); // skin tone
    expect(keywordMatches("so good", "🔥")).toBe(false);
  });
  it("exact emoji keyword requires an emoji-only comment", () => {
    expect(keywordMatches("🔥 !", "🔥", "exact")).toBe(true);
    expect(keywordMatches("great 🔥", "🔥", "exact")).toBe(false);
  });
  it("ignores blank keywords", () => {
    expect(keywordMatches("anything", "   ")).toBe(false);
    expect(keywordMatches("anything", "!!!")).toBe(false);
  });
});

describe("matchComment", () => {
  it("returns the rule and the keyword as written", () => {
    const r = rule("a", ["Link", "DRIVE"]);
    expect(matchComment("drive 🙏", [r])).toEqual({ rule: r, keyword: "DRIVE" });
  });

  it("returns the first matching keyword of a rule", () => {
    const r = rule("a", ["guide", "free"]);
    expect(matchComment("free guide", [r])?.keyword).toBe("guide");
  });

  it("returns null when nothing matches or input is empty", () => {
    expect(matchComment("hello", [rule("a", ["drive"])])).toBeNull();
    expect(matchComment("", [rule("a", ["drive"])])).toBeNull();
    expect(matchComment("drive", [])).toBeNull();
  });

  it("prefers higher priority regardless of order", () => {
    const low = rule("low", ["drive"], { priority: 0 });
    const high = rule("high", ["drive"], { priority: 10 });
    expect(matchComment("drive", [low, high])?.rule.id).toBe("high");
  });

  it("keeps input order for equal priority", () => {
    const a = rule("a", ["drive"]);
    const b = rule("b", ["drive"]);
    expect(matchComment("drive", [a, b])?.rule.id).toBe("a");
    expect(matchComment("drive", [b, a])?.rule.id).toBe("b");
  });

  it("falls through to lower priority rules when higher ones don't match", () => {
    const high = rule("high", ["ebook"], { priority: 5 });
    const low = rule("low", ["drive"], { priority: 1 });
    expect(matchComment("drive pls", [high, low])?.rule.id).toBe("low");
  });

  it("ignores inactive rules", () => {
    const off = rule("off", ["drive"], { isActive: false, priority: 100 });
    const on = rule("on", ["drive"], { isActive: true });
    expect(matchComment("drive", [off, on])?.rule.id).toBe("on");
    expect(matchComment("drive", [off])).toBeNull();
  });

  it("applies each rule's own match mode", () => {
    const exact = rule("exact", ["drive"], { matchMode: "exact", priority: 2 });
    const contains = rule("contains", ["drive"], { matchMode: "contains", priority: 1 });
    expect(matchComment("drive", [exact, contains])?.rule.id).toBe("exact");
    expect(matchComment("my googledrive", [exact, contains])?.rule.id).toBe("contains");
    expect(matchComment("drive please", [exact])).toBeNull();
  });

  it("handles many keywords across rules", () => {
    const rules = [
      rule("prices", ["harga", "price", "berapa"]),
      rule("links", ["link", "drive", "url"], { priority: 1 }),
    ];
    expect(matchComment("Berapa kak?", rules)?.rule.id).toBe("prices");
    expect(matchComment("berapa? kirim link dong", rules)?.rule.id).toBe("links");
  });
});
