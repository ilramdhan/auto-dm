/**
 * Postgres integration test: a database whose migrations were pasted into the Supabase SQL editor by
 * hand must still migrate cleanly on the next build. Uses its own database
 * (`<TEST_DATABASE_URL db>_adopt`). Skipped when TEST_DATABASE_URL is not set.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type postgres from "postgres";
import { adoptManualMigrations } from "../../scripts/adopt-migrations";

const BASE = process.env.TEST_DATABASE_URL;
const FOLDER = "./drizzle/migrations";
const ALL_TAGS = (
  JSON.parse(readFileSync(`${FOLDER}/meta/_journal.json`, "utf8")) as { entries: { tag: string }[] }
).entries.map((e) => e.tag);

describe.skipIf(!BASE)("adoptManualMigrations (Postgres integration)", () => {
  let admin: postgres.Sql;
  let url: string;
  let dbName: string;

  async function freshDb(): Promise<postgres.Sql> {
    const { default: pg } = await import("postgres");
    await admin.unsafe(`drop database if exists "${dbName}" with (force)`);
    await admin.unsafe(`create database "${dbName}"`);
    return pg(url, { max: 1, onnotice: () => {} });
  }

  async function runByHand(sql: postgres.Sql, tags: string[]) {
    for (const tag of tags) {
      await sql.unsafe(
        readFileSync(`${FOLDER}/${tag}.sql`, "utf8").replaceAll("--> statement-breakpoint", ""),
      );
    }
  }

  async function drizzleMigrate(sql: postgres.Sql) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(drizzle({ client: sql }), { migrationsFolder: FOLDER });
  }

  beforeAll(async () => {
    const { default: pg } = await import("postgres");
    const u = new URL(BASE!);
    dbName = `${u.pathname.slice(1)}_adopt`;
    u.pathname = `/${dbName}`;
    url = u.toString();
    admin = pg(BASE!, { max: 1, onnotice: () => {} });
  });

  afterAll(async () => {
    await admin.unsafe(`drop database if exists "${dbName}" with (force)`);
    await admin.end();
  });

  it("adopts every migration that was run by hand, then migrate() is a no-op", async () => {
    const sql = await freshDb();
    try {
      await runByHand(sql, ALL_TAGS);
      const adopted = await adoptManualMigrations(sql, FOLDER);
      expect(adopted).toContain("0000_init");
      expect(adopted).toContain("0002_delivery_action_status");
      await expect(drizzleMigrate(sql)).resolves.toBeUndefined();
      const [{ count }] = await sql<
        [{ count: number }]
      >`select count(*)::int as count from drizzle.__drizzle_migrations`;
      expect(count).toBe(ALL_TAGS.length);
    } finally {
      await sql.end();
    }
  });

  it("applies the migrations that were skipped by hand", async () => {
    const sql = await freshDb();
    try {
      await runByHand(sql, ["0000_init"]);
      await adoptManualMigrations(sql, FOLDER);
      await drizzleMigrate(sql);
      const cols = await sql`select 1 from information_schema.columns
                             where table_name = 'deliveries' and column_name = 'dm_status'`;
      expect(cols).toHaveLength(1);
    } finally {
      await sql.end();
    }
  });

  it("does nothing on a fresh or drizzle-managed database", async () => {
    const sql = await freshDb();
    try {
      expect(await adoptManualMigrations(sql, FOLDER)).toEqual([]);
      await drizzleMigrate(sql);
      expect(await adoptManualMigrations(sql, FOLDER)).toEqual([]);
    } finally {
      await sql.end();
    }
  });
});
