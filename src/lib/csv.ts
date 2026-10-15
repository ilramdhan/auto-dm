import { APP_NAME } from "@/lib/constants";

/** Maximum data rows in one CSV export (keeps memory and response time bounded). */
export const CSV_ROW_LIMIT = 50_000;

/** UTF-8 byte order mark so Excel opens the file as UTF-8 (emoji, diacritics). */
export const CSV_BOM = "﻿";

/** RFC 4180 CSV cell; also neutralizes spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows → CRLF-separated CSV text (with a trailing CRLF) prefixed with a UTF-8 BOM. */
export function toCsv(rows: unknown[][], { bom = true }: { bom?: boolean } = {}): string {
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
  return bom ? CSV_BOM + body : body;
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

/** `YYYY-MM-DD HH:mm:ss` of `date` as seen in `timeZone`; empty string for null. */
export function formatCsvDateTime(date: Date | null | undefined, timeZone: string): string {
  if (!date) return "";
  let f = dateTimeFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    dateTimeFormatters.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/** Lowercase, dash-separated slug of the app name for download file names. */
export function appSlug(name: string = APP_NAME): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export"
  );
}

/** Response headers for a CSV download. */
export function csvHeaders(filename: string): Record<string, string> {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
}
