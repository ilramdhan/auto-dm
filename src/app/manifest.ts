import type { MetadataRoute } from "next";
import { THEME_COLORS } from "@/lib/brand-mark";
import { SITE } from "@/lib/seo";

/** Web app manifest (served at /manifest.webmanifest; Next adds the <link rel="manifest">). */
export default function manifest(): MetadataRoute.Manifest {
  const shortcutIcon = [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }];
  return {
    id: "/",
    name: SITE.name,
    short_name: SITE.shortName,
    description: SITE.description,
    lang: "en",
    dir: "ltr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    categories: ["business", "productivity", "social", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Dashboard", url: "/dashboard", icons: shortcutIcon },
      { name: "Campaigns", short_name: "Campaigns", url: "/campaigns", icons: shortcutIcon },
      { name: "Activity", short_name: "Activity", url: "/activity", icons: shortcutIcon },
    ],
  };
}
