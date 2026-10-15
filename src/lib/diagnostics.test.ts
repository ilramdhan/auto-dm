import { describe, expect, it } from "vitest";
import { classifyDbLatency } from "./diagnostics";

describe("classifyDbLatency", () => {
  it("classifies by threshold", () => {
    expect(classifyDbLatency(0)).toBe("good");
    expect(classifyDbLatency(49)).toBe("good");
    expect(classifyDbLatency(50)).toBe("fair");
    expect(classifyDbLatency(149)).toBe("fair");
    expect(classifyDbLatency(150)).toBe("slow");
    expect(classifyDbLatency(900)).toBe("slow");
  });
});
