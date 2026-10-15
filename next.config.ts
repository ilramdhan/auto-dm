import { randomUUID } from "node:crypto";
import type { NextConfig } from "next";
import { resolveBuildId } from "./src/lib/build-id";

// Build id for stale-client detection (#87): inlined into both the client and the server bundles, so
// `/api/version` (server) and the RecoveryMonitor (browser) compare ids from the same build. Stored in
// process.env so build workers (child processes) inherit the same value instead of generating their own.
const buildId = process.env.NEXT_PUBLIC_BUILD_ID || resolveBuildId(process.env, randomUUID());
process.env.NEXT_PUBLIC_BUILD_ID = buildId;

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (Vercel ignores this setting).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  experimental: {
    // Client router cache: going back to a page opened in the last 30 s is instant instead of
    // re-rendering on the server (#64). Mutations still refresh via revalidatePath/router.refresh.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [
      {
        // The service worker must always be revalidated so a new deploy's version is picked up.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
