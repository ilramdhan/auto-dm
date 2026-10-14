import { describe, expect, it } from "vitest";
import { pickRandom, renderTemplate, truncateText } from "./template";

describe("renderTemplate", () => {
  it("replaces variables", () => {
    expect(
      renderTemplate("Hi @{username}, here is your {keyword} link", { username: "ana", keyword: "drive" }),
    ).toBe("Hi @ana, here is your drive link");
  });

  it("is case/whitespace tolerant inside braces and replaces every occurrence", () => {
    expect(renderTemplate("{ USERNAME } {username} {Keyword}", { username: "a", keyword: "k" })).toBe(
      "a a k",
    );
  });

  it("leaves unknown placeholders and other braces untouched", () => {
    expect(renderTemplate("{name} {} {{username}}", { username: "a" })).toBe("{name} {} {a}");
  });

  it("is safe when values are missing", () => {
    expect(renderTemplate("Hi @{username}! Sent 🙌", {})).toBe("Hi! Sent 🙌");
    expect(renderTemplate("Hi {username}, thanks", { username: null })).toBe("Hi, thanks");
    expect(renderTemplate("Your {keyword} link", { keyword: "" })).toBe("Your link");
  });

  it("does not interpret replacement patterns in values", () => {
    expect(renderTemplate("Hi {username}", { username: "$&$1" })).toBe("Hi $&$1");
  });

  it("keeps newlines", () => {
    expect(renderTemplate("Hi {username}\n\nLink: x", { username: "a" })).toBe("Hi a\n\nLink: x");
  });
});

describe("truncateText", () => {
  it("keeps short text", () => {
    expect(truncateText("abc", 5)).toBe("abc");
  });
  it("adds an ellipsis within the limit", () => {
    const out = truncateText("a".repeat(1200), 1000);
    expect(Array.from(out)).toHaveLength(1000);
    expect(out.endsWith("…")).toBe(true);
  });
  it("never splits surrogate pairs", () => {
    const out = truncateText("😀".repeat(10), 5);
    expect(out).toBe("😀😀😀😀…");
  });
});

describe("pickRandom", () => {
  it("returns undefined for empty lists and picks by index", () => {
    expect(pickRandom([])).toBeUndefined();
    expect(pickRandom(["a", "b", "c"], () => 0)).toBe("a");
    expect(pickRandom(["a", "b", "c"], () => 0.99)).toBe("c");
    expect(pickRandom(["a", "b"], () => 1)).toBe("b");
  });
});
