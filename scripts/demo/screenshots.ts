/**
 * Retakes the README screenshots in docs/assets/screenshots/ from a running app that uses the demo
 * database (see "Demo data for screenshots" in docs/development.md):
 *
 *   SCREENSHOT_BASE_URL=http://localhost:3000 pnpm demo:screenshots
 *
 * Env: SCREENSHOT_BASE_URL (default http://localhost:3000), DEMO_PASSWORD (default demo-password-2026).
 * Pages are captured at 1440px wide (390px for mobile) with deviceScaleFactor 2, light theme except
 * dashboard-dark, then downscaled to 1600px wide (780px for mobile) and saved as palette PNG.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";

/** The small slice of sharp's API this script uses (sharp ships with Next, see scripts/brand/banner.tsx). */
type SharpPipeline = {
  resize(width: number): SharpPipeline;
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
const OUT = join(ROOT, "docs", "assets", "screenshots");
const requireFromNext = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
const sharp = requireFromNext("sharp") as SharpFactory;

const BASE = (process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-password-2026";

type Shot = {
  name: string;
  path: string;
  width: number;
  height: number;
  outWidth: number;
  theme?: "light" | "dark";
  auth?: boolean;
  prepare?: (page: Page) => Promise<void>;
};

const SHOTS: Shot[] = [
  { name: "landing", path: "/", width: 1440, height: 900, outWidth: 1600, auth: false },
  { name: "dashboard-light", path: "/dashboard", width: 1440, height: 1290, outWidth: 1600 },
  { name: "dashboard-dark", path: "/dashboard", width: 1440, height: 1290, outWidth: 1600, theme: "dark" },
  { name: "dashboard-mobile", path: "/dashboard", width: 390, height: 844, outWidth: 780 },
  { name: "activity", path: "/activity", width: 1440, height: 1000, outWidth: 1600 },
  { name: "analytics", path: "/analytics", width: 1440, height: 1050, outWidth: 1600 },
  {
    name: "campaign-rule-editor",
    path: "/campaigns",
    width: 1440,
    height: 1290,
    outWidth: 1600,
    prepare: async (page) => {
      await page
        .getByRole("link", { name: /Free Notion & Drive templates/ })
        .first()
        .click();
      await page.waitForURL(/\/campaigns\/[^/]+$/);
      await page.getByRole("button", { name: "Edit" }).first().click();
      await page.getByText("Edit “Template folder”").waitFor();
    },
  },
  {
    name: "settings-instagram",
    path: "/settings",
    width: 1440,
    height: 1100,
    outWidth: 1600,
    prepare: async (page) => {
      await page.getByRole("tab", { name: "Instagram" }).click();
      await page.getByText("Meta app").first().waitFor();
    },
  },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
      const theme = shot.theme ?? "light";
      const context = await browser.newContext({
        viewport: { width: shot.width, height: shot.height },
        deviceScaleFactor: 2,
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      await context.addInitScript((t) => {
        try {
          localStorage.setItem("theme", t);
        } catch {
          /* storage unavailable */
        }
      }, theme);
      const page = await context.newPage();
      if (shot.auth !== false) {
        await page.goto(`${BASE}/login`);
        await page.locator("#username").fill("admin");
        await page.locator("#password").fill(PASSWORD);
        await page.getByRole("button", { name: /sign in|log in/i }).click();
        await page.waitForURL((u) => !u.pathname.startsWith("/login"));
      }
      await page.goto(`${BASE}${shot.path}`);
      await page.waitForLoadState("networkidle");
      await shot.prepare?.(page);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.mouse.move(0, 0);
      await page.waitForTimeout(800);
      const png = await page.screenshot();
      const out = await sharp(png)
        .resize(shot.outWidth)
        .png({ compressionLevel: 9, palette: true, quality: 90, dither: 0.5 })
        .toBuffer();
      writeFileSync(join(OUT, `${shot.name}.png`), out);
      console.log(`${shot.name}.png  ${(out.length / 1024).toFixed(0)} KB`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
