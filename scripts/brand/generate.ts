/**
 * Regenerates every brand icon from the canonical SVG in src/lib/brand-mark.ts:
 *
 *   pnpm brand:icons
 *
 * Outputs (all committed):
 *   src/app/icon.svg              favicon for modern browsers (Next emits the <link> tag)
 *   src/app/favicon.ico           16/32/48 px PNG entries for legacy browsers
 *   src/app/apple-icon.png        180x180, opaque, full bleed (iOS rounds the corners itself)
 *   public/icons/icon-192.png     PWA manifest icons ("any" purpose, rounded)
 *   public/icons/icon-512.png
 *   public/icons/icon-maskable-512.png  full bleed, glyph inside the 80% safe zone
 *
 * Rasterising uses sharp, which Next.js already installs for image optimisation, so no extra
 * dependency is needed. It is resolved through Next's own dependency tree.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brandMarkSvg, THEME_COLORS, type BrandMarkOptions } from "../../src/lib/brand-mark";
import { buildIco, pngSize } from "./ico";

/** The small slice of sharp's API this script uses. */
type SharpPipeline = {
  flatten(options: { background: string }): SharpPipeline;
  removeAlpha(): SharpPipeline;
  png(options: { compressionLevel: number; palette?: boolean }): SharpPipeline;
  toBuffer(): Promise<Buffer>;
};
type SharpFactory = (input: Buffer) => SharpPipeline;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const requireFromNext = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
const sharp = requireFromNext("sharp") as SharpFactory;

/** Small favicons need a bolder glyph to stay legible. */
const SMALL: BrandMarkOptions = { glyph: 0.64, stroke: 2.75 };

async function render(size: number, options: BrandMarkOptions, opaque = false): Promise<Buffer> {
  const svg = brandMarkSvg(options).replace("<svg ", `<svg width="${size}" height="${size}" `);
  let pipeline = sharp(Buffer.from(svg));
  if (opaque) pipeline = pipeline.flatten({ background: THEME_COLORS.light }).removeAlpha();
  const png = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  const actual = pngSize(png);
  if (actual.width !== size || actual.height !== size) {
    throw new Error(`Expected ${size}x${size}, got ${actual.width}x${actual.height}`);
  }
  return png;
}

function write(relative: string, data: string | Buffer) {
  const file = join(ROOT, relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log(`wrote ${relative} (${Buffer.byteLength(data)} bytes)`);
}

async function main() {
  write("src/app/icon.svg", `${brandMarkSvg()}\n`);

  const ico = buildIco(
    await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await render(size, SMALL) }))),
  );
  write("src/app/favicon.ico", ico);

  write("src/app/apple-icon.png", await render(180, { radius: 0 }, true));
  write("public/icons/icon-192.png", await render(192, {}));
  write("public/icons/icon-512.png", await render(512, {}));
  // Maskable: launchers crop to any shape inside the central 80% circle, so bleed the gradient to
  // the edges and keep the glyph (50% box, ~35% radius incl. stroke) well inside the safe zone.
  write("public/icons/icon-maskable-512.png", await render(512, { radius: 0, glyph: 0.5 }, true));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
