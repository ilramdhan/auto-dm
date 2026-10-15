/**
 * Regenerates the README banner and the GitHub social preview:
 *
 *   pnpm brand:banner
 *
 * Outputs (all committed):
 *   docs/assets/banner-light.png     1600x400, README header for light mode
 *   docs/assets/banner-dark.png      1600x400, README header for dark mode
 *   docs/assets/social-preview.png   1280x640, upload in GitHub repo Settings -> General -> Social preview
 *
 * Rendering uses `next/og` (satori + resvg, with the Geist font Next bundles), the same engine and
 * design as the Open Graph card in src/lib/og-image.tsx, so no extra dependency or system font is
 * needed and the output is identical on every machine. sharp (installed by Next) then quantises the
 * PNGs to keep them small.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "next/og";
import { BRAND_GRADIENT, brandMarkDataUri, THEME_COLORS } from "../../src/lib/brand-mark";
import { renderOgImage } from "../../src/lib/og-image";

/** The small slice of sharp's API this script uses. */
type SharpPipeline = {
  png(options: {
    compressionLevel: number;
    palette?: boolean;
    quality?: number;
    dither?: number;
  }): SharpPipeline;
  toBuffer(): Promise<Buffer>;
};
type SharpFactory = (input: Buffer) => SharpPipeline;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const requireFromNext = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
const sharp = requireFromNext("sharp") as SharpFactory;

const BANNER = { width: 1600, height: 400 } as const;
const SOCIAL = { width: 1280, height: 640 } as const;

const NAME = "AutoDM";
const PITCH =
  "Comment a keyword on Instagram, get a public reply and a DM automatically. Free, self-hosted, open source.";
const CHIPS = ["Open source · MIT", "Self-hosted", "n8n ready"] as const;

const gradient = `linear-gradient(90deg, ${BRAND_GRADIENT.map((s) => `${s.color} ${s.offset * 100}%`).join(", ")})`;

type Theme = "light" | "dark";

const PALETTE: Record<
  Theme,
  { background: string; glow: string; title: string; text: string; chipText: string; chipBorder: string }
> = {
  dark: {
    background: THEME_COLORS.dark,
    glow: "radial-gradient(circle at 92% 0%, rgba(129, 52, 175, 0.55), transparent 45%), radial-gradient(circle at 0% 100%, rgba(245, 133, 41, 0.28), transparent 40%)",
    title: "#fafafa",
    text: "#cfcfda",
    chipText: "#e4e4ec",
    chipBorder: "rgba(255, 255, 255, 0.22)",
  },
  light: {
    background: THEME_COLORS.light,
    glow: "radial-gradient(circle at 92% 0%, rgba(129, 52, 175, 0.16), transparent 45%), radial-gradient(circle at 0% 100%, rgba(245, 133, 41, 0.14), transparent 40%)",
    title: "#121216",
    text: "#4a4a57",
    chipText: "#33333d",
    chipBorder: "rgba(18, 18, 22, 0.18)",
  },
};

function renderBanner(theme: Theme): ImageResponse {
  const c = PALETTE[theme];
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 56,
        padding: "0 96px",
        backgroundColor: c.background,
        backgroundImage: c.glow,
        color: c.title,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>. */}
      <img src={brandMarkDataUri()} width={176} height={176} alt="" />
      <div style={{ display: "flex", flexDirection: "column", gap: 22, flex: 1 }}>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>{NAME}</div>
        <div style={{ fontSize: 32, lineHeight: 1.35, color: c.text, maxWidth: 1080 }}>{PITCH}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
          {CHIPS.map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                fontSize: 24,
                padding: "8px 20px",
                borderRadius: 999,
                border: `1px solid ${c.chipBorder}`,
                color: c.chipText,
              }}
            >
              {label}
            </div>
          ))}
          <div
            style={{
              display: "flex",
              width: 140,
              height: 10,
              marginLeft: 18,
              borderRadius: 999,
              backgroundImage: gradient,
            }}
          />
        </div>
      </div>
    </div>,
    { ...BANNER },
  );
}

async function compress(response: Response): Promise<Buffer> {
  const raw = Buffer.from(await response.arrayBuffer());
  // 256-colour palette with light dithering: the gradients stay smooth at a fraction of the size.
  return sharp(raw).png({ compressionLevel: 9, palette: true, quality: 100, dither: 1 }).toBuffer();
}

function write(relative: string, data: Buffer) {
  const file = join(ROOT, relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log(`wrote ${relative} (${Math.round(data.byteLength / 1024)} KB)`);
}

async function main() {
  write("docs/assets/banner-light.png", await compress(renderBanner("light")));
  write("docs/assets/banner-dark.png", await compress(renderBanner("dark")));
  write("docs/assets/social-preview.png", await compress(renderOgImage(SOCIAL)));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
