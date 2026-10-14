import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

/**
 * One pooled client per serverless instance. Supabase's transaction pooler (port 6543)
 * does not support prepared statements, hence `prepare: false`.
 */
const globalForDb = globalThis as unknown as { __pg?: postgres.Sql };

function client(): postgres.Sql {
  if (!globalForDb.__pg) {
    globalForDb.__pg = postgres(env().DATABASE_URL, { prepare: false, max: 5, idle_timeout: 20 });
  }
  return globalForDb.__pg;
}

export const db = drizzle({ client: client(), schema, casing: "snake_case" });
export type Db = typeof db;
export { schema };
