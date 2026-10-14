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

function createDb() {
  return drizzle({ client: client(), schema, casing: "snake_case" });
}
export type Db = ReturnType<typeof createDb>;

let instance: Db | undefined;

/**
 * Lazily connected: importing this module never reads env or opens a connection, so
 * `next build` (Docker images, CI, forks) works without DATABASE_URL/APP_SECRET.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    instance ??= createDb();
    const value = Reflect.get(instance, prop, instance) as unknown;
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
  },
});
export { schema };
