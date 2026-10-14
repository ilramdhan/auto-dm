/**
 * Applies SQL migrations from ./drizzle/migrations. Runs automatically before `next build`
 * (see package.json) so a fresh Vercel + Supabase deploy needs no manual DB step.
 * Prefers a direct (non-pooled) connection for DDL.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;

async function main() {
  if (!url) {
    console.warn("[migrate] No database URL set - skipping migrations.");
    return;
  }
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await migrate(drizzle({ client: sql }), { migrationsFolder: "./drizzle/migrations" });
    console.log("[migrate] Database is up to date.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[migrate] Failed:", err);
  process.exit(1);
});
