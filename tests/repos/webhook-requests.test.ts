/**
 * Postgres integration test for webhook diagnostics (recording, account matching, ring-buffer
 * pruning). Uses its own database (`<TEST_DATABASE_URL db>_webhook_requests`, created on demand).
 * Skipped when TEST_DATABASE_URL is not set.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const BASE = process.env.TEST_DATABASE_URL;

describe.skipIf(!BASE)("webhook request log (Postgres integration)", () => {
  let sql: import("postgres").Sql;
  let mod: typeof import("@/server/repos/webhook-requests");

  beforeAll(async () => {
    const url = new URL(BASE!);
    const dbName = `${url.pathname.slice(1)}_webhook_requests`;
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

    mod = await import("@/server/repos/webhook-requests");
  });

  beforeEach(async () => {
    await sql`truncate webhook_requests, instagram_accounts cascade`;
  });

  afterAll(async () => {
    await sql?.end();
  });

  it("records counts and whether entries were for the connected account", async () => {
    await mod.recordWebhookRequest({
      kind: "delivery",
      source: "direct",
      result: "accepted",
      statusCode: 200,
      entries: 1,
      entryIds: ["17841400000000001"],
      commentEvents: 1,
    });
    await sql`insert into instagram_accounts (ig_user_id, username, access_token_enc) values ('17841400000000001', 'me', 'x')`;
    await mod.recordWebhookRequest({
      kind: "delivery",
      source: "n8n",
      result: "accepted",
      statusCode: 200,
      entries: 2,
      entryIds: ["17841400000000001", "other"],
      commentEvents: 2,
    });
    const rows = await mod.listWebhookRequests("delivery");
    expect(rows.map((r) => [r.source, r.matchedEntries, r.commentEvents])).toEqual([
      ["n8n", 1, 2],
      ["direct", null, 1],
    ]);
  });

  it("keeps only the newest rows per kind", async () => {
    await sql`insert into webhook_requests (kind, result, status_code, created_at)
      select 'delivery', 'accepted', 200, now() - (g || ' minutes')::interval from generate_series(1, 60) g`;
    await sql`insert into webhook_requests (kind, result, status_code) values ('verification', 'verified', 200)`;
    await mod.recordWebhookRequest({
      kind: "delivery",
      source: "direct",
      result: "accepted",
      statusCode: 200,
    });
    const [delivered] = await sql<
      { n: number }[]
    >`select count(*)::int as n from webhook_requests where kind = 'delivery'`;
    expect(delivered?.n).toBe(50);
    const [verified] = await sql<
      { v: number }[]
    >`select count(*)::int as v from webhook_requests where kind = 'verification'`;
    expect(verified?.v).toBe(1);
  });

  it("never throws, even when the insert fails", async () => {
    await expect(
      mod.recordWebhookRequest({
        kind: "delivery",
        source: "direct",
        // Invalid enum value forces a DB error.
        result: "nope" as never,
        statusCode: 200,
      }),
    ).resolves.toBeUndefined();
  });
});
