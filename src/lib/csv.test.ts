import { describe, expect, it } from "vitest";
import { appSlug, CSV_BOM, csvCell, csvHeaders, formatCsvDateTime, toCsv } from "./csv";

describe("csvCell", () => {
  it("quotes commas, quotes and newlines (RFC 4180)", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell("plain")).toBe("plain");
  });
  it("renders null/undefined as empty and keeps 0/false", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(false)).toBe("false");
  });
  it.each(["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"])("neutralizes formula start %j", (v) => {
    expect(csvCell(v).replace(/^"|"$/g, "")).toMatch(/^'/);
  });
  it("neutralizes then quotes when needed", () => {
    expect(csvCell('=HYPERLINK("x","y")')).toBe('"\'=HYPERLINK(""x"",""y"")"');
  });
  it("keeps emoji and diacritics", () => {
    expect(csvCell("kopi ☕ café")).toBe("kopi ☕ café");
  });
  it("serializes dates as ISO", () => {
    expect(csvCell(new Date("2026-01-02T03:04:05Z"))).toBe("2026-01-02T03:04:05.000Z");
  });
});

describe("toCsv", () => {
  it("uses CRLF, trailing CRLF and a BOM by default", () => {
    expect(
      toCsv([
        ["a", 1],
        ["b", 2],
      ]),
    ).toBe(`${CSV_BOM}a,1\r\nb,2\r\n`);
  });
  it("can omit the BOM", () => {
    expect(toCsv([["a"]], { bom: false })).toBe("a\r\n");
  });
});

describe("formatCsvDateTime", () => {
  const d = new Date("2026-10-14T18:30:05Z");
  it("formats in the given zone", () => {
    expect(formatCsvDateTime(d, "Asia/Jakarta")).toBe("2026-10-15 01:30:05");
    expect(formatCsvDateTime(d, "UTC")).toBe("2026-10-14 18:30:05");
  });
  it("uses 00 (not 24) at midnight", () => {
    expect(formatCsvDateTime(new Date("2026-10-14T17:00:00Z"), "Asia/Jakarta")).toBe("2026-10-15 00:00:00");
  });
  it("returns empty for null", () => {
    expect(formatCsvDateTime(null, "UTC")).toBe("");
  });
});

describe("appSlug / csvHeaders", () => {
  it("slugifies", () => {
    expect(appSlug("Auto Reply_IG!")).toBe("auto-reply-ig");
    expect(appSlug("***")).toBe("export");
  });
  it("sets download headers", () => {
    const h = csvHeaders("x.csv");
    expect(h["Content-Disposition"]).toBe('attachment; filename="x.csv"');
    expect(h["Cache-Control"]).toBe("no-store");
    expect(h["Content-Type"]).toContain("text/csv");
  });
});
