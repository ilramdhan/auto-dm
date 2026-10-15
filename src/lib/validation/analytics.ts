import { z } from "zod";
import { addDaysYmd, DEFAULT_TIME_ZONE, diffDaysYmd, ymdInZone, zonedMidnight } from "@/lib/timezone";

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
  /** Inclusive start: 00:00 of the first day in `timeZone`, as a UTC instant. */
  from: Date;
  /** Exclusive end: 00:00 of the day after the last day in `timeZone`. */
  to: Date;
  timeZone: string;
  days: number;
  label: string;
  preset: RangePreset;
  fromYmd: string;
  toYmd: string;
};

export function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Turns filters into a concrete window of whole calendar days in `timeZone` (DST-safe).
 * Custom ranges are ordered, clamped to today and to MAX_RANGE_DAYS.
 */
export function resolveRange(
  f: Pick<AnalyticsFilters, "range" | "from" | "to">,
  now = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): ResolvedRange {
  const today = ymdInZone(now, timeZone);
  let preset: RangePreset = f.range;
  let first: string;
  let last: string;
  if (
    preset === "custom" &&
    f.from &&
    f.to &&
    !Number.isNaN(Date.parse(f.from)) &&
    !Number.isNaN(Date.parse(f.to))
  ) {
    [first, last] = f.from <= f.to ? [f.from, f.to] : [f.to, f.from];
    if (last > today) last = today;
    if (first > last) first = last;
    if (diffDaysYmd(first, last) + 1 > MAX_RANGE_DAYS) first = addDaysYmd(last, -(MAX_RANGE_DAYS - 1));
  } else {
    if (preset === "custom") preset = "30d";
    const n = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
    first = addDaysYmd(today, -(n - 1));
    last = today;
  }
  const days = diffDaysYmd(first, last) + 1;
  return {
    from: zonedMidnight(first, timeZone),
    to: zonedMidnight(addDaysYmd(last, 1), timeZone),
    timeZone,
    days,
    label: preset === "custom" ? `${first} – ${last}` : `Last ${days} days`,
    preset,
    fromYmd: first,
    toYmd: last,
  };
}

export function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}
