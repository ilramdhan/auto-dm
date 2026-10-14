import { z } from "zod";

export const RANGE_PRESETS = ["7d", "30d", "90d", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export const MAX_RANGE_DAYS = 366;

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** `/analytics` search params. Invalid values fall back to defaults instead of erroring. */
export const analyticsFiltersSchema = z.object({
  range: z.enum(RANGE_PRESETS).catch("30d").default("30d"),
  from: ymd.optional().catch(undefined),
  to: ymd.optional().catch(undefined),
  campaign: z.uuid().optional().catch(undefined),
  group: z.enum(["campaign", "post"]).catch("campaign").default("campaign"),
});
export type AnalyticsFilters = z.infer<typeof analyticsFiltersSchema>;

export type ResolvedRange = {
  /** Inclusive start (00:00 UTC). */
  from: Date;
  /** Exclusive end (00:00 UTC of the day after the last day). */
  to: Date;
  days: number;
  label: string;
  preset: RangePreset;
  fromYmd: string;
  toYmd: string;
};

const DAY = 24 * 60 * 60 * 1000;

export function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Turns filters into a concrete UTC day window. Custom ranges are clamped and ordered. */
export function resolveRange(
  f: Pick<AnalyticsFilters, "range" | "from" | "to">,
  now = new Date(),
): ResolvedRange {
  const today = startOfUtcDay(now);
  let preset: RangePreset = f.range;
  let first: Date;
  let last: Date;
  if (preset === "custom" && f.from && f.to) {
    first = new Date(`${f.from}T00:00:00Z`);
    last = new Date(`${f.to}T00:00:00Z`);
    if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) {
      preset = "30d";
      first = new Date(today.getTime() - 29 * DAY);
      last = today;
    } else {
      if (first > last) [first, last] = [last, first];
      if (last > today) last = today;
      if ((last.getTime() - first.getTime()) / DAY + 1 > MAX_RANGE_DAYS)
        first = new Date(last.getTime() - (MAX_RANGE_DAYS - 1) * DAY);
    }
  } else {
    if (preset === "custom") preset = "30d";
    const n = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
    first = new Date(today.getTime() - (n - 1) * DAY);
    last = today;
  }
  const days = Math.round((last.getTime() - first.getTime()) / DAY) + 1;
  const label = preset === "custom" ? `${toYmd(first)} – ${toYmd(last)}` : `Last ${days} days`;
  return {
    from: first,
    to: new Date(last.getTime() + DAY),
    days,
    label,
    preset,
    fromYmd: toYmd(first),
    toYmd: toYmd(last),
  };
}

export function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

/** RFC 4180 CSV cell; also neutralizes spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
