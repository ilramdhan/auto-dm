/**
 * Calendar-day helpers in an IANA time zone (no dependencies; Intl only). Isomorphic.
 * A "ymd" is a `YYYY-MM-DD` calendar date in the configured zone.
 */

export const DEFAULT_TIME_ZONE = "UTC";

/** Common zones shown first in the UI; any valid IANA zone is accepted. */
export const COMMON_TIME_ZONES = [
  "UTC",
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "Asia/Manila",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
] as const;

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const ymdFormatters = new Map<string, Intl.DateTimeFormat>();
function ymdFormatter(tz: string): Intl.DateTimeFormat {
  let f = ymdFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    ymdFormatters.set(tz, f);
  }
  return f;
}

/** Calendar date of `date` as seen in `tz`. */
export function ymdInZone(date: Date, tz: string): string {
  return ymdFormatter(tz).format(date);
}

/** `ymd` shifted by `n` calendar days. */
export function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole calendar days from `a` to `b` (b - a). */
export function diffDaysYmd(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Offset of `tz` from UTC at instant `at`, in ms (e.g. +7h for Asia/Jakarta). */
function zoneOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The UTC instant of 00:00 on calendar day `ymd` in `tz` (DST-safe). */
export function zonedMidnight(ymd: string, tz: string): Date {
  const guess = Date.parse(`${ymd}T00:00:00Z`);
  let instant = guess - zoneOffsetMs(new Date(guess), tz);
  // Re-check once: the offset can differ at the corrected instant around DST transitions.
  const second = guess - zoneOffsetMs(new Date(instant), tz);
  if (second !== instant) instant = second;
  return new Date(instant);
}
