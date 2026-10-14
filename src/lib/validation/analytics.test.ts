import { describe, expect, it } from "vitest";
import { analyticsFiltersSchema, csvCell, pct, resolveRange, toCsv } from "./analytics";

const NOW = new Date("2026-10-14T15:30:00Z");

describe("resolveRange", () => {
  it("covers N whole UTC days ending today", () => {
    const r = resolveRange({ range: "7d" }, NOW);
    expect(r.fromYmd).toBe("2026-10-08");
    expect(r.toYmd).toBe("2026-10-14");
    expect(r.to.toISOString()).toBe("2026-10-15T00:00:00.000Z");
    expect(r.days).toBe(7);
  });
  it("orders and clamps custom ranges", () => {
    const r = resolveRange({ range: "custom", from: "2026-10-20", to: "2026-10-01" }, NOW);
    expect(r.fromYmd).toBe("2026-10-01");
    expect(r.toYmd).toBe("2026-10-14");
    expect(r.days).toBe(14);
  });
  it("falls back to 30 days when custom bounds are missing", () => {
    const r = resolveRange({ range: "custom" }, NOW);
    expect(r.preset).toBe("30d");
    expect(r.days).toBe(30);
  });
  it("parses search params leniently", () => {
    expect(analyticsFiltersSchema.parse({ range: "1y", group: "x" })).toMatchObject({
      range: "30d",
      group: "campaign",
    });
  });
});

describe("csv", () => {
  it("quotes and neutralizes formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK()")).toBe("'=HYPERLINK()");
    expect(csvCell(null)).toBe("");
    expect(
      toCsv([
        ["a", 1],
        ["b", 2],
      ]),
    ).toBe("a,1\r\nb,2\r\n");
  });
  it("pct handles zero", () => {
    expect(pct(1, 0)).toBeNull();
    expect(pct(1, 3)).toBe(33.3);
  });
});
