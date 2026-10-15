/**
 * Postgres integration test for operator-initiated commenter data deletion (email requests). Uses its
 * own database (`<TEST_DATABASE_URL db>_commenter`, created on demand) so it can run in parallel with
 * the other integration tests. Skipped when TEST_DATABASE_URL is not set.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const BASE = process.env.TEST_DATABASE_URL;
const ACCOUNT_IG = "17841400000000077";
const COMMENTER = "9990001";

describe.skipIf(!BASE)("deleteCommenterData (Postgres integration)", () => {
  let sql: import("postgres").Sql;
  let mod: typeof import("@/server/instagram/data-deletion");

  beforeAll(async () => {
    const url = new URL(BASE!);
    const dbName = `${url.pathname.slice(1)}_commenter`;
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

    mod = await import("@/server/instagram/data-deletion");
  });

  beforeEach(async () => {
    await sql`truncate deliveries, rules, campaigns, instagram_accounts, data_deletion_requests cascade`;
    await sql`
      insert into instagram_accounts (ig_user_id, username, name, access_token_enc, token_expires_at)
      values (${ACCOUNT_IG}, 'shop', 'Shop', 'v1:enc', now() + interval '30 days')`;
    const rows = [
      ["c1", COMMENTER, "Jane.Doe"],
      ["c2", COMMENTER, "jane.doe"],
      ["c3", "5550001", "janet"],
      ["c4", "5550002", "jane_doe"],
      ["c5", null, "JANE.DOE"],
    ] as const;
    for (const [commentId, commenterId, username] of rows) {
      await sql`insert into deliveries (comment_id, ig_user_id, commenter_id, commenter_username, comment_text)
                values (${commentId}, ${ACCOUNT_IG}, ${commenterId}, ${username}, 'hello')`;
    }
  });

  afterAll(async () => {
    await sql?.end();
    await (globalThis as unknown as { __pg?: { end: () => Promise<void> } }).__pg?.end();
  });

  async function commentIds(): Promise<string[]> {
    const rows = await sql<{ comment_id: string }[]>`select comment_id from deliveries order by comment_id`;
    return rows.map((r) => r.comment_id);
  }

  async function request(code: string) {
    const [row] = await sql<{ ig_user_id: string | null; status: string }[]>`
      select ig_user_id, status from data_deletion_requests where confirmation_code = ${code}`;
    return row;
  }

  async function accountUntouched() {
    const [acc] = await sql`select * from instagram_accounts where ig_user_id = ${ACCOUNT_IG}`;
    expect(acc).toMatchObject({
      username: "shop",
      name: "Shop",
      is_active: true,
      access_token_enc: "v1:enc",
    });
  }

  it("deletes by commenter id only, leaving other commenters' rows", async () => {
    const res = await mod.deleteCommenterData({ commenterId: COMMENTER });
    expect(res).toMatchObject({ status: "completed", deleted: 2 });
    expect(res.confirmationCode).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(await commentIds()).toEqual(["c3", "c4", "c5"]);
    expect(await request(res.confirmationCode)).toMatchObject({ ig_user_id: COMMENTER, status: "completed" });
    const lookup = await mod.getDeletionRequest(res.confirmationCode);
    expect(lookup?.status).toBe("completed");
    expect(lookup?.completedAt).toBeInstanceOf(Date);
    await accountUntouched();
  });

  it("deletes by username case-insensitively, ignoring a leading @", async () => {
    const res = await mod.deleteCommenterData({ username: "@JANE.doe" });
    expect(res).toMatchObject({ status: "completed", deleted: 3 });
    // "jane_doe" and "janet" are different people: no LIKE wildcards, no prefix match.
    expect(await commentIds()).toEqual(["c3", "c4"]);
    expect(await request(res.confirmationCode)).toMatchObject({ ig_user_id: null, status: "completed" });
    await accountUntouched();
  });

  it("records 'no_data' when nothing matches", async () => {
    const res = await mod.deleteCommenterData({ username: "nobody" });
    expect(res).toMatchObject({ status: "no_data", deleted: 0 });
    expect(await commentIds()).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    expect(await request(res.confirmationCode)).toMatchObject({ status: "no_data" });
    const byId = await mod.deleteCommenterData({ commenterId: "424242" });
    expect(byId).toMatchObject({ status: "no_data", deleted: 0 });
    expect(byId.confirmationCode).not.toBe(res.confirmationCode);
  });

  it("never touches instagram_accounts, even when the id is the connected account's", async () => {
    const res = await mod.deleteCommenterData({ commenterId: ACCOUNT_IG });
    expect(res).toMatchObject({ status: "no_data", deleted: 0 });
    expect(await commentIds()).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    await accountUntouched();
  });

  it("rejects a call with neither id nor username", async () => {
    await expect(mod.deleteCommenterData({})).rejects.toThrow();
    const count = await sql`select count(*)::int as n from data_deletion_requests`;
    expect(count[0]!.n).toBe(0);
  });
});
