import { renderOgImage } from "@/lib/og-image";
import { OG_ALT, OG_SIZE } from "@/lib/seo";

// Same card as the Open Graph image (summary_large_image is also 1200x630).
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function TwitterImage() {
  return renderOgImage();
}
