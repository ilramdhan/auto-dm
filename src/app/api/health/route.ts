import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { noStore } from "@/server/instagram/http";
import { logger } from "@/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = logger("health");

/** Liveness + DB ping. Exposes no configuration or secrets. */
export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json(
      { status: "ok", db: "ok", latencyMs: Date.now() - started },
      { headers: noStore() },
    );
  } catch (err) {
    log.error("health.db_unreachable", { err: err instanceof Error ? err.name : "unknown" });
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503, headers: noStore() });
  }
}
