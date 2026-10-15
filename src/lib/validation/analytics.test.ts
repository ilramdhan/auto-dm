import { describe, expect, it } from "vitest";
import { analyticsFiltersSchema, pct, resolveRange } from "./analytics";

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

describe("pct", () => {
  it("pct handles zero", () => {
    expect(pct(1, 0)).toBeNull();
    expect(pct(1, 3)).toBe(33.3);
  });
});

describe("resolveRange in a time zone", () => {
  // 2026-10-14T18:30Z is already 2026-10-15 01:30 in Jakarta (UTC+7).
  const now = new Date("2026-10-14T18:30:00Z");

  it("uses the zone's calendar day for 'today'", () => {
    const r = resolveRange({ range: "7d" }, now, "Asia/Jakarta");
    expect(r.toYmd).toBe("2026-10-15");
    expect(r.fromYmd).toBe("2026-10-09");
    expect(r.days).toBe(7);
    expect(r.from.toISOString()).toBe("2026-10-08T17:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-15T17:00:00.000Z");
    expect(r.timeZone).toBe("Asia/Jakarta");
  });

  it("keeps whole local days across a DST change", () => {
    const later = new Date("2026-11-01T12:00:00Z");
    const r = resolveRange({ range: "custom", from: "2026-10-24", to: "2026-10-26" }, later, "Europe/Berlin");
    expect(r.days).toBe(3);
    expect((r.to.getTime() - r.from.getTime()) / 3_600_000).toBe(73);
  });
});
