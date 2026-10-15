import { renderOgImage } from "@/lib/og-image";
import { OG_ALT, OG_SIZE } from "@/lib/seo";

// Static: rendered once at build time (no env or request data). Pages in nested segments point at
// it through publicPageMetadata() in src/lib/seo.ts.
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgImage();
}
