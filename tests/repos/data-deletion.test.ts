/**
 * Postgres integration test for Meta's deauthorize / data deletion callbacks. Uses its own database
 * (`<TEST_DATABASE_URL db>_deletion`, created on demand) so it can run in parallel with the other
 * integration tests. Skipped when TEST_DATABASE_URL is not set.
 */
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const BASE = process.env.TEST_DATABASE_URL;
const APP_SECRET_SETTING = "meta-app-secret-for-tests-0002";
const ACCOUNT_IG = "17841400000000077";
const OTHER_IG = "17841400000000088";
const COMMENTER = "9990001";
const CAMPAIGN = "33333333-3333-4333-8333-333333333333";

function signedRequest(userId: string, secret = APP_SECRET_SETTING): string {
  const payload = Buffer.from(
    JSON.stringify({ algorithm: "HMAC-SHA256", issued_at: 1_790_000_000, user_id: userId }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${sig}.${payload}`;
}

function form(body: Record<string, string>): Request {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
}

describe.skipIf(!BASE)("data deletion (Postgres integration)", () => {
  let sql: import("postgres").Sql;
  let mod: typeof import("@/server/instagram/data-deletion");
  let deletionRoute: typeof import("@/app/api/instagram/data-deletion/route");
  let deauthorizeRoute: typeof import("@/app/api/instagram/deauthorize/route");

  beforeAll(async () => {
    const url = new URL(BASE!);
    const dbName = `${url.pathname.slice(1)}_deletion`;
    const { default: postgres } = await import("postgres");
    const admin = postgres(BASE!, { max: 1, onnotice: () => {} });
    const exists = await admin`select 1 from pg_database where datname = ${dbName}`;
    if (exists.length === 0) await admin.unsafe(`create database "${dbName}"`);
    await admin.end();
    url.pathname = `/${dbName}`;
    process.env.DATABASE_URL = url.toString();
    process.env.APP_SECRET ??= "dev-secret-dev-secret-dev-secret-dev-secret";
    process.env.APP_URL = "https://autodm.example.com";
    process.env.LOG_LEVEL = "error";

    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
    await migrate(drizzle({ client: sql }), { migrationsFolder: "./drizzle/migrations" });

    mod = await import("@/server/instagram/data-deletion");
    deletionRoute = await import("@/app/api/instagram/data-deletion/route");
    deauthorizeRoute = await import("@/app/api/instagram/deauthorize/route");
  });

  beforeEach(async () => {
    await sql`truncate deliveries, rules, campaigns, instagram_accounts, data_deletion_requests, settings cascade`;
    const accounts = await sql<{ id: string }[]>`
      insert into instagram_accounts (ig_user_id, username, name, profile_picture_url, access_token_enc, token_expires_at)
      values (${ACCOUNT_IG}, 'shop', 'Shop', 'https://cdninstagram.com/p.jpg', 'v1:enc', now() + interval '30 days'),
             (${OTHER_IG}, 'other', null, null, 'v1:other', null)
      returning id`;
    await sql`insert into campaigns (id, account_id, name) values (${CAMPAIGN}, ${accounts[0]!.id}, 'All posts')`;
    const rows = [
      ["c1", ACCOUNT_IG, COMMENTER],
      ["c2", ACCOUNT_IG, "5550001"],
      ["c3", OTHER_IG, COMMENTER],
      ["c4", OTHER_IG, "5550002"],
    ] as const;
    for (const [commentId, igUserId, commenterId] of rows) {
      await sql`insert into deliveries (comment_id, ig_user_id, commenter_id, commenter_username, comment_text)
                values (${commentId}, ${igUserId}, ${commenterId}, ${"u" + commenterId}, 'hello')`;
    }
    const { setSetting } = await import("@/server/settings");
    await setSetting("meta.appSecret", APP_SECRET_SETTING);
  });

  afterAll(async () => {
    await sql?.end();
    await (globalThis as unknown as { __pg?: { end: () => Promise<void> } }).__pg?.end();
  });

  async function commentIds(): Promise<string[]> {
    const rows = await sql<{ comment_id: string }[]>`select comment_id from deliveries order by comment_id`;
    return rows.map((r) => r.comment_id);
  }

  it("deauthorizeUser wipes the matching account's token but keeps its row and data", async () => {
    expect(await mod.deauthorizeUser(ACCOUNT_IG)).toBe(true);
    const [acc] = await sql`select * from instagram_accounts where ig_user_id = ${ACCOUNT_IG}`;
    expect(acc).toMatchObject({
      is_active: false,
      access_token_enc: "",
      token_expires_at: null,
      username: "shop",
    });
    const [other] = await sql`select * from instagram_accounts where ig_user_id = ${OTHER_IG}`;
    expect(other).toMatchObject({ is_active: true, access_token_enc: "v1:other" });
    expect(await commentIds()).toEqual(["c1", "c2", "c3", "c4"]);
    expect(await mod.deauthorizeUser("123")).toBe(false);
  });

  it("deleteUserData removes a commenter's deliveries everywhere", async () => {
    const res = await mod.deleteUserData(COMMENTER);
    expect(res).toMatchObject({ status: "completed", deletedDeliveries: 2, accountWiped: false });
    expect(res.confirmationCode).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(await commentIds()).toEqual(["c2", "c4"]);
    const lookup = await mod.getDeletionRequest(res.confirmationCode);
    expect(lookup?.status).toBe("completed");
    expect(lookup?.completedAt).toBeInstanceOf(Date);
  });

  it("deleteUserData wipes a connected account and the comments it received, keeping campaigns", async () => {
    const res = await mod.deleteUserData(ACCOUNT_IG);
    expect(res).toMatchObject({ status: "completed", deletedDeliveries: 2, accountWiped: true });
    expect(await commentIds()).toEqual(["c3", "c4"]);
    const [acc] = await sql`select * from instagram_accounts where ig_user_id = ${ACCOUNT_IG}`;
    expect(acc).toMatchObject({
      is_active: false,
      access_token_enc: "",
      token_expires_at: null,
      token_refreshed_at: null,
      username: "deleted",
      name: null,
      profile_picture_url: null,
    });
    const campaigns = await sql`select id from campaigns where id = ${CAMPAIGN}`;
    expect(campaigns).toHaveLength(1);
  });

  it("deleteUserData records 'no_data' when nothing matched", async () => {
    const res = await mod.deleteUserData("424242");
    expect(res).toMatchObject({ status: "no_data", deletedDeliveries: 0, accountWiped: false });
    expect(await commentIds()).toEqual(["c1", "c2", "c3", "c4"]);
    expect((await mod.getDeletionRequest(res.confirmationCode))?.status).toBe("no_data");
    expect(await mod.getDeletionRequest("A".repeat(24))).toBeNull();
  });

  it("data deletion route answers with Meta's { url, confirmation_code }", async () => {
    const res = await deletionRoute.POST(form({ signed_request: signedRequest(COMMENTER) }) as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; confirmation_code: string };
    expect(Object.keys(body).sort()).toEqual(["confirmation_code", "url"]);
    expect(body.url).toBe(`https://autodm.example.com/data-deletion?code=${body.confirmation_code}`);
    expect(await commentIds()).toEqual(["c2", "c4"]);
  });

  it("routes reject bad signatures, missing fields and a missing app secret with 400", async () => {
    for (const route of [deletionRoute, deauthorizeRoute]) {
      const bad = await route.POST(
        form({ signed_request: signedRequest(COMMENTER, "wrong-secret-000000") }) as never,
      );
      expect(bad.status).toBe(400);
      expect(await bad.json()).toEqual({ error: "invalid_request" });
      expect((await route.POST(form({}) as never)).status).toBe(400);
    }
    await sql`delete from settings where key = 'meta.appSecret'`;
    const res = await deletionRoute.POST(form({ signed_request: signedRequest(COMMENTER) }) as never);
    expect(res.status).toBe(400);
    expect(await commentIds()).toEqual(["c1", "c2", "c3", "c4"]);
    const count = await sql`select count(*)::int as n from data_deletion_requests`;
    expect(count[0]!.n).toBe(0);
  });

  it("deauthorize route disconnects the account", async () => {
    const res = await deauthorizeRoute.POST(form({ signed_request: signedRequest(ACCOUNT_IG) }) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    const [acc] =
      await sql`select is_active, access_token_enc from instagram_accounts where ig_user_id = ${ACCOUNT_IG}`;
    expect(acc).toMatchObject({ is_active: false, access_token_enc: "" });
  });
});
