/**
 * Minimal Semantic Versioning (semver.org 2.0) comparison — enough for "is a newer release
 * out?". Isomorphic, no dependencies. A leading "v" is accepted; build metadata is ignored.
 */

type Parsed = { core: [number, number, number]; pre: string[] };

const SEMVER =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function parseSemver(input: string): Parsed | null {
  const m = SEMVER.exec(input.trim());
  if (!m) return null;
  return {
    core: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre: m[4] ? m[4].split(".") : [],
  };
}

function comparePre(a: string[], b: string[]): number {
  // A version without a prerelease ranks higher than one with it (1.0.0 > 1.0.0-rc.1).
  if (a.length === 0 || b.length === 0) return a.length === b.length ? 0 : a.length === 0 ? 1 : -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) return Number(x) < Number(y) ? -1 : 1;
    if (xn !== yn) return xn ? -1 : 1; // numeric identifiers rank lower than alphanumeric ones
    return x < y ? -1 : 1;
  }
  return 0;
}

/** -1 / 0 / 1 like a sort comparator, or `null` when either side isn't a valid version. */
export function compareSemver(a: string, b: string): -1 | 0 | 1 | null {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    const x = pa.core[i] ?? 0;
    const y = pb.core[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  const pre = comparePre(pa.pre, pb.pre);
  return pre === 0 ? 0 : pre < 0 ? -1 : 1;
}

/** True only when `latestTag` is a valid version strictly newer than `current`. */
export function isUpdateAvailable(current: string, latestTag: string): boolean {
  return compareSemver(current, latestTag) === -1;
}

/** "v1.2.3" → "1.2.3" (display helper). */
export function stripV(tag: string): string {
  return tag.replace(/^v(?=\d)/, "");
}
