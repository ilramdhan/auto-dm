import { readFileSync } from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type postgres from "postgres";

/**
 * Postgres errors that mean "this migration already ran": the object it creates is already there.
 * duplicate_table, duplicate_object (types, constraints, indexes), duplicate_column, duplicate_schema.
 */
const ALREADY_APPLIED = new Set(["42P07", "42710", "42701", "42P06"]);

/**
 * Some people paste the SQL files into the Supabase SQL editor by hand. Drizzle then has no record of
 * them and the next build tries `CREATE TYPE ...` again and fails. When the migrations journal is
 * empty but the app's tables exist, replay each migration in its own transaction: one that fails
 * because its objects already exist is rolled back and recorded as applied; one that succeeds was
 * genuinely missing. Afterwards drizzle's normal `migrate()` continues from there.
 *
 * Returns the tags recorded as already applied. No-op on fresh or drizzle-managed databases.
 */
export async function adoptManualMigrations(sql: postgres.Sql, migrationsFolder: string): Promise<string[]> {
  const [{ hasAppTables }] = await sql<[{ hasAppTables: boolean }]>`
    select to_regclass('public.users') is not null as "hasAppTables"`;
  if (!hasAppTables) return [];

  // Same shape drizzle-orm creates for its journal.
  await sql`create schema if not exists drizzle`;
  await sql`create table if not exists drizzle.__drizzle_migrations (
    id serial primary key, hash text not null, created_at bigint)`;
  const [{ count }] = await sql<[{ count: number }]>`
    select count(*)::int as count from drizzle.__drizzle_migrations`;
  if (count > 0) return [];

  const tags = journalTags(migrationsFolder);
  const adopted: string[] = [];
  for (const [i, m] of readMigrationFiles({ migrationsFolder }).entries()) {
    try {
      await sql.begin(async (tx) => {
        for (const stmt of m.sql) if (stmt.trim()) await tx.unsafe(stmt);
        await tx`insert into drizzle.__drizzle_migrations (hash, created_at)
                 values (${m.hash}, ${m.folderMillis})`;
      });
    } catch (err) {
      const code = (err as { code?: unknown }).code;
      if (typeof code !== "string" || !ALREADY_APPLIED.has(code)) throw err;
      await sql`insert into drizzle.__drizzle_migrations (hash, created_at)
                values (${m.hash}, ${m.folderMillis})`;
      adopted.push(tags[i] ?? String(m.folderMillis));
    }
  }
  return adopted;
}

function journalTags(migrationsFolder: string): string[] {
  try {
    const journal = JSON.parse(readFileSync(`${migrationsFolder}/meta/_journal.json`, "utf8")) as {
      entries: { tag: string }[];
    };
    return journal.entries.map((e) => e.tag);
  } catch {
    return [];
  }
}
