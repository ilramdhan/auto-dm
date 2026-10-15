import type { Metadata } from "next";
import { APP_NAME, REPO_URL } from "@/lib/constants";

/** Copy shared by page metadata, the Open Graph image, the web app manifest and JSON-LD. */
export const SITE = {
  name: APP_NAME,
  shortName: "AutoDM",
  headline: "Turn Instagram comments into replies and DMs, automatically",
  tagline: "Open-source, self-hosted comment-to-DM automation for Instagram.",
  description:
    "Open-source Instagram comment-to-DM automation: keyword rules per post, public replies and private-reply DMs. Self-hosted on Vercel + Supabase or Docker, n8n ready.",
  keywords: [
    "autodm",
    "instagram auto dm",
    "auto dm instagram",
    "instagram comment to dm",
    "comment to dm",
    "instagram auto reply",
    "instagram private reply",
    "manychat alternative",
    "open source",
    "self-hosted",
    "n8n",
    "instagram automation",
  ],
  repoUrl: REPO_URL,
} as const;

/** Social card (src/app/opengraph-image.tsx, twitter-image.tsx). */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_ALT = `${SITE.name}: ${SITE.headline}`;

/** Indexable pages; everything else (dashboard, auth, API) is noindex. */
export const PUBLIC_PATHS = ["/", "/privacy", "/terms", "/data-deletion"] as const;

/** Paths crawlers should skip (robots.txt). Pages behind sign-in also send `noindex`. */
export const PRIVATE_PATHS = [
  "/api/",
  "/dashboard",
  "/campaigns",
  "/analytics",
  "/activity",
  "/settings",
  "/login",
  "/change-password",
  "/offline",
] as const;

/** Joins a path onto the base URL, or returns the path unchanged when the base is unknown. */
export function absoluteUrl(base: string | null, path: string): string {
  return base ? `${base}${path}` : path;
}

/**
 * Serialises JSON-LD for an inline `<script type="application/ld+json">`, escaping `<` so the
 * payload can never close the script element or open a comment.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * Metadata for an indexable public page: canonical URL plus Open Graph / Twitter titles. A child
 * `openGraph`/`twitter` object replaces the parent's (including the root opengraph-image and
 * twitter-image files), so the shared fields and the card image are repeated here.
 */
export function publicPageMetadata({
  title,
  description = SITE.description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description?: string;
  path: (typeof PUBLIC_PATHS)[number];
  absoluteTitle?: boolean;
}): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: "en_US",
      alternateLocale: ["id_ID"],
      title,
      description,
      url: path,
      images: [{ url: "/opengraph-image", type: "image/png", ...OG_SIZE, alt: OG_ALT }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: "/twitter-image", type: "image/png", ...OG_SIZE, alt: OG_ALT }],
    },
  };
}
