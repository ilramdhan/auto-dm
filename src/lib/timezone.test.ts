import { describe, expect, it } from "vitest";
import { addDaysYmd, diffDaysYmd, isValidTimeZone, ymdInZone, zonedMidnight } from "./timezone";

describe("timezone helpers", () => {
  it("validates IANA zones", () => {
    expect(isValidTimeZone("Asia/Jakarta")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });

  it("reads the calendar date in a zone", () => {
    const t = new Date("2026-10-14T18:30:00Z"); // 01:30 next day in Jakarta (UTC+7)
    expect(ymdInZone(t, "UTC")).toBe("2026-10-14");
    expect(ymdInZone(t, "Asia/Jakarta")).toBe("2026-10-15");
    expect(ymdInZone(t, "America/Los_Angeles")).toBe("2026-10-14");
  });

  it("computes zoned midnight as a UTC instant", () => {
    expect(zonedMidnight("2026-10-15", "Asia/Jakarta").toISOString()).toBe("2026-10-14T17:00:00.000Z");
    expect(zonedMidnight("2026-10-15", "UTC").toISOString()).toBe("2026-10-15T00:00:00.000Z");
    // US DST: summer (UTC-7) and winter (UTC-8)
    expect(zonedMidnight("2026-07-01", "America/Los_Angeles").toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(zonedMidnight("2026-12-01", "America/Los_Angeles").toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });

  it("handles DST transition days (23h / 25h)", () => {
    const tz = "Europe/Berlin";
    const springStart = zonedMidnight("2026-03-29", tz);
    const springEnd = zonedMidnight("2026-03-30", tz);
    expect((springEnd.getTime() - springStart.getTime()) / 3_600_000).toBe(23);
    const fallStart = zonedMidnight("2026-10-25", tz);
    const fallEnd = zonedMidnight("2026-10-26", tz);
    expect((fallEnd.getTime() - fallStart.getTime()) / 3_600_000).toBe(25);
  });

  it("does calendar arithmetic", () => {
    expect(addDaysYmd("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysYmd("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDaysYmd("2026-10-01", "2026-10-15")).toBe(14);
  });
});
