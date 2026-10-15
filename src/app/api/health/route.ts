import { NextResponse } from "next/server";
import { noStore } from "@/server/instagram/http";
import { pingDb, serverRegion } from "@/server/diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness + DB ping. Exposes no configuration or secrets. */
export async function GET() {
  const ping = await pingDb();
  if (!ping.ok) {
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503, headers: noStore() });
  }
  const headers = new Headers(noStore());
  // Visible in the browser's DevTools → Network → Timing.
  headers.set("Server-Timing", `db;desc="select 1";dur=${ping.latencyMs}`);
  return NextResponse.json(
    {
      status: "ok",
      db: "ok",
      latencyMs: ping.latencyMs,
      // Where this function runs (Vercel sets it). Compare with the database region when pages are slow.
      region: serverRegion(),
    },
    { headers },
  );
}
