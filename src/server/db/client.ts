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
    // connect_timeout: fail fast (error page) instead of leaving pages on their loading skeleton
    // when the database is unreachable.
    // idle_timeout / max_lifetime: drop pooled sockets well before Supavisor or a NAT closes them, so a
    // reused (thawed) serverless instance is less likely to send its first query on a dead socket. The
    // remaining cases are retried once by `withDbRetry` (./retry.ts).
    globalForDb.__pg = postgres(env().DATABASE_URL, {
      prepare: false,
      max: 5,
      idle_timeout: 15,
      max_lifetime: 60 * 10,
      connect_timeout: 10,
    });
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
export { isTransientDbError, retryable, withDbRetry } from "./retry";
