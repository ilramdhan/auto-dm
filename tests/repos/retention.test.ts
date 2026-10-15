/**
 * Postgres integration test for the retention purge. Uses its own database
 * (`<TEST_DATABASE_URL db>_retention`, created on demand) so it can run in parallel with the other
 * integration tests. Skipped when TEST_DATABASE_URL is not set.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const BASE = process.env.TEST_DATABASE_URL;
const NOW = new Date("2026-10-15T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!BASE)("retention purge (Postgres integration)", () => {
  let sql: import("postgres").Sql;
  let mod: typeof import("@/server/repos/retention");

  beforeAll(async () => {
    const url = new URL(BASE!);
    const dbName = `${url.pathname.slice(1)}_retention`;
    const { default: postgres } = await import("postgres");
    const admin = postgres(BASE!, { max: 1, onnotice: () => {} });
    const exists = await admin`select 1 from pg_database where datname = ${dbName}`;
    if (exists.length === 0) await admin.unsafe(`create database "${dbName}"`);
    await admin.end();
    url.pathname = `/${dbName}`;
    process.env.DATABASE_URL = url.toString();
    process.env.APP_SECRET ??= "dev-secret-dev-secret-dev-secret-dev-secret";
    process.env.LOG_LEVEL = "error";

    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
    await migrate(drizzle({ client: sql }), { migrationsFolder: "./drizzle/migrations" });

    mod = await import("@/server/repos/retention");
  });

  beforeEach(async () => {
    await sql`truncate deliveries cascade`;
  });

  afterAll(async () => {
    await sql?.end();
    await (globalThis as unknown as { __pg?: { end: () => Promise<void> } }).__pg?.end();
  });

  async function seed(id: string, ageDays: number) {
    const createdAt = new Date(NOW.getTime() - ageDays * DAY);
    await sql`insert into deliveries (comment_id, comment_text, created_at) values (${id}, 'hi', ${createdAt.toISOString()}::timestamptz)`;
  }

  async function remaining(): Promise<string[]> {
    const rows = await sql<{ comment_id: string }[]>`select comment_id from deliveries order by comment_id`;
    return rows.map((r) => r.comment_id);
  }

  it("deletes only rows older than the cutoff", async () => {
    await seed("old1", 400);
    await seed("old2", 366);
    await seed("new1", 364);
    await seed("new2", 1);
    expect(await mod.purgeOldDeliveries(365, NOW)).toBe(2);
    expect(await remaining()).toEqual(["new1", "new2"]);
  });

  it("keeps everything when retention is 0 (forever)", async () => {
    await seed("ancient", 5000);
    await seed("new", 1);
    expect(await mod.purgeOldDeliveries(0, NOW)).toBe(0);
    expect(await remaining()).toEqual(["ancient", "new"]);
  });

  it("deletes in batches and stops at maxBatches", async () => {
    for (let i = 0; i < 7; i++) await seed(`old${i}`, 100 + i);
    await seed("new", 1);
    // 2 batches of 3 -> 6 deleted, then the run stops; the next run continues.
    expect(await mod.purgeOldDeliveries(30, NOW, { batchSize: 3, maxBatches: 2 })).toBe(6);
    expect(await remaining()).toHaveLength(2);
    expect(await mod.purgeOldDeliveries(30, NOW, { batchSize: 3, maxBatches: 2 })).toBe(1);
    expect(await remaining()).toEqual(["new"]);
  });

  it("handles an exact multiple of the batch size and an empty table", async () => {
    expect(await mod.purgeOldDeliveries(30, NOW)).toBe(0);
    for (let i = 0; i < 4; i++) await seed(`old${i}`, 100);
    expect(await mod.purgeOldDeliveries(30, NOW, { batchSize: 2, maxBatches: 10 })).toBe(4);
    expect(await remaining()).toEqual([]);
  });
});
