/**
 * Canonical brand mark: the Instagram-style gradient square with a reply-bubble glyph, as plain SVG.
 * Single source for `src/app/icon.svg`, the generated PNG/ICO icons (scripts/brand/generate.ts) and
 * the Open Graph image, so they always match `<BrandMark>` in src/components/brand.tsx.
 *
 * The glyph is lucide's `message-circle-reply` (ISC licence) drawn as paths, so no font is needed.
 */

/** Gradient stops, kept in sync with the `brand-gradient` utility in globals.css. */
export const BRAND_GRADIENT = [
  { offset: 0, color: "#f58529" },
  { offset: 0.45, color: "#dd2a7b" },
  { offset: 0.75, color: "#8134af" },
  { offset: 1, color: "#515bd4" },
] as const;

/** Theme surface colours (sRGB approximations of --background in light and dark mode). */
export const THEME_COLORS = { light: "#fcfcfd", dark: "#121216" } as const;

/** lucide `message-circle-reply` paths on a 24x24 grid. */
const GLYPH_PATHS = [
  "M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719",
  "m10 15-3-3 3-3",
  "M7 12h8a2 2 0 0 1 2 2v1",
] as const;

export type BrandMarkOptions = {
  /** Corner radius as a fraction of the size (BrandMark uses rounded-lg on 32px: 10/32). 0 = full bleed. */
  radius?: number;
  /** Glyph box as a fraction of the size (BrandMark: 55%). Keep <= 0.56 for maskable icons. */
  glyph?: number;
  /** Stroke width on the 24px glyph grid (BrandMark: 2.25). */
  stroke?: number;
};

const VIEWBOX = 512;

/** Returns a standalone SVG document for the brand mark (512x512 viewBox, scales to any size). */
export function brandMarkSvg({
  radius = 0.3125,
  glyph = 0.55,
  stroke = 2.25,
}: BrandMarkOptions = {}): string {
  const box = VIEWBOX * glyph;
  const offset = round((VIEWBOX - box) / 2);
  const scale = round(box / 24);
  const rx = round(VIEWBOX * radius);
  const stops = BRAND_GRADIENT.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join("");
  const paths = GLYPH_PATHS.map((d) => `<path d="${d}"/>`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs>` +
    `<rect width="${VIEWBOX}" height="${VIEWBOX}" rx="${rx}" fill="url(#g)"/>` +
    `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#fff" ` +
    `stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>` +
    `</svg>`
  );
}

/** `data:` URI of the mark, e.g. for `<img>` inside `next/og` ImageResponse. */
export function brandMarkDataUri(options?: BrandMarkOptions): string {
  return `data:image/svg+xml;base64,${toBase64(brandMarkSvg(options))}`;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function toBase64(s: string): string {
  // Isomorphic: Buffer on the server, btoa in the browser (the SVG is ASCII-only).
  return typeof Buffer !== "undefined" ? Buffer.from(s, "utf8").toString("base64") : btoa(s);
}
