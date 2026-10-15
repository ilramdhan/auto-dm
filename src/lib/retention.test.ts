import { describe, expect, it } from "vitest";
import { retentionCutoff, retentionLabel } from "./retention";
import { retentionDaysSchema } from "./validation/settings";

describe("retention", () => {
  const now = new Date("2026-10-15T12:00:00.000Z");

  it("computes the cutoff", () => {
    expect(retentionCutoff(30, now)?.toISOString()).toBe("2026-09-15T12:00:00.000Z");
    expect(retentionCutoff(365, now)?.toISOString()).toBe("2025-10-15T12:00:00.000Z");
  });

  it("returns null when keeping forever or invalid", () => {
    expect(retentionCutoff(0, now)).toBeNull();
    expect(retentionCutoff(-5, now)).toBeNull();
    expect(retentionCutoff(Number.NaN, now)).toBeNull();
  });

  it("labels options", () => {
    expect(retentionLabel(0)).toBe("Keep forever");
    expect(retentionLabel(90)).toBe("90 days");
  });

  it("accepts only the allowed values", () => {
    for (const v of [30, 90, 180, 365, 0]) expect(retentionDaysSchema.safeParse(v).success).toBe(true);
    for (const v of [1, 31, -1, "30", null]) expect(retentionDaysSchema.safeParse(v).success).toBe(false);
  });
});
