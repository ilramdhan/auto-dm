import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/env";
import { PRIVATE_PATHS } from "@/lib/seo";

// Read APP_URL at request time (a Docker image is built without it).
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = publicBaseUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
