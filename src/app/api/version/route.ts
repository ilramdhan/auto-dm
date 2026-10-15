import { NextResponse } from "next/server";
import { noStore } from "@/server/instagram/http";
import { getAppVersion } from "@/server/updates";
import { normalizeBuildId } from "@/lib/build-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which build is serving requests (#87). Open tabs and installed PWAs compare `buildId` with the id
 * inlined into their own bundle and reload when it differs. Public and DB-free: exposes only the
 * release version and the build/deployment id, both already visible in the page's assets.
 */
export function GET() {
  return NextResponse.json(
    {
      version: getAppVersion().version,
      buildId: normalizeBuildId(process.env.NEXT_PUBLIC_BUILD_ID) ?? "unknown",
    },
    { headers: noStore() },
  );
}
