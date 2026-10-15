import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/env";
import { absoluteUrl, PUBLIC_PATHS } from "@/lib/seo";

// Read APP_URL at request time (a Docker image is built without it).
export const dynamic = "force-dynamic";

/** Public, indexable pages. Without a configured base URL the entries stay relative. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicBaseUrl();
  return PUBLIC_PATHS.map((path) => ({
    url: absoluteUrl(base, path),
    changeFrequency: path === "/" ? "monthly" : "yearly",
    priority: path === "/" ? 1 : 0.3,
  }));
}
