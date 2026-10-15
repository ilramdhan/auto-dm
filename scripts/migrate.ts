/**
 * Applies SQL migrations from ./drizzle/migrations. Runs automatically before `next build`
 * (see package.json) so a fresh Vercel + Supabase deploy needs no manual DB step.
 * Prefers a direct (non-pooled) connection for DDL.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { adoptManualMigrations } from "./adopt-migrations";

const MIGRATIONS = "./drizzle/migrations";

// `||` (not `??`): an env var saved empty in the Vercel dashboard must fall through to the next one.
const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

async function main() {
  if (!url) {
    console.warn("[migrate] No database URL set - skipping migrations.");
    return;
  }
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const adopted = await adoptManualMigrations(sql, MIGRATIONS);
    if (adopted.length > 0)
      console.log(`[migrate] Found tables created by hand; marked as applied: ${adopted.join(", ")}`);
    await migrate(drizzle({ client: sql }), { migrationsFolder: MIGRATIONS });
    console.log("[migrate] Database is up to date.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[migrate] Failed:", err);
  process.exit(1);
});
