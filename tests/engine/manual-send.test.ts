/**
 * Integration tests for manual send and "Check post for missed comments" against a real Postgres.
 * Skipped when TEST_DATABASE_URL is not set (see tests/engine/process-comment.test.ts for setup).
 * Graph API calls are served by a mocked `fetch`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
const OUR_IG_ID = "17841400000000001";
const MEDIA = "18000000000000001";

type Mods = {
  db: typeof import("@/server/db/client");
  schema: typeof import("@/server/db/schema");
  crypto: typeof import("@/server/crypto");
  settings: typeof import("@/server/settings");
  manual: typeof import("@/server/engine/manual-send");
};

describe.skipIf(!TEST_DB)("manual send + missed comment sync (Postgres integration)", () => {
  let m: Mods;
  let fetchMock: ReturnType<typeof vi.fn<(url: URL, init: RequestInit) => Promise<Response>>>;
  let commentsPage: unknown = { data: [] };
  let seq = 0;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.APP_SECRET ??= "dev-secret-dev-secret-dev-secret-dev-secret";
    process.env.LOG_LEVEL = "error";
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const sql = postgres(TEST_DB!, { max: 1, onnotice: () => {} });
    await migrate(drizzle({ client: sql }), { migrationsFolder: "./drizzle/migrations" });
    await sql.end();
    m = {
      db: await import("@/server/db/client"),
      schema: await import("@/server/db/schema"),
      crypto: await import("@/server/crypto"),
      settings: await import("@/server/settings"),
      manual: await import("@/server/engine/manual-send"),
    };
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await (globalThis as unknown as { __pg?: { end: () => Promise<void> } }).__pg?.end();
  });

  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await m.db.db.execute(sql`TRUNCATE deliveries, rules, campaigns, instagram_accounts, settings CASCADE`);
    commentsPage = { data: [] };
    fetchMock = vi.fn(async (url: URL) => {
      seq++;
      if (url.pathname.endsWith("/replies")) return json({ id: `reply_${seq}` });
      if (url.pathname.endsWith("/messages"))
        return json({ recipient_id: "igsid", message_id: `mid_${seq}` });
      if (url.pathname.endsWith("/comments")) return json(commentsPage);
      return json({ error: { message: "unexpected call", code: 1 } }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  async function seed() {
    const { db } = m.db;
    const { instagramAccounts, campaigns, rules } = m.schema;
    const [account] = await db
      .insert(instagramAccounts)
      .values({
        igUserId: OUR_IG_ID,
        username: "ourbrand",
        accessTokenEnc: m.crypto.encrypt("IGTOKEN_test_123456"),
      })
      .returning();
    const [post] = await db
      .insert(campaigns)
      .values({ name: "Reel", mediaId: MEDIA, accountId: account!.id })
      .returning();
    const [rule] = await db
      .insert(rules)
      .values({
        campaignId: post!.id,
        name: "drive",
        keywords: ["drive"],
        publicReplies: ["Check your DM @{username}"],
        dmMessage: "Hi {username}: {keyword}",
      })
      .returning();
    return { account: account!, post: post!, rule: rule! };
  }

  let n = 0;
  async function skippedRow(over: Partial<typeof m.schema.deliveries.$inferInsert> = {}) {
    const [row] = await m.db.db
      .insert(m.schema.deliveries)
      .values({
        commentId: `mc_${++n}`,
        mediaId: MEDIA,
        igUserId: OUR_IG_ID,
        commenterId: "user_1",
        commenterUsername: "alice",
        commentText: "hello there",
        status: "skipped",
        skipReason: "no_match",
        ...over,
      })
      .returning();
    return row!;
  }

  async function get(id: string) {
    const { eq } = await import("drizzle-orm");
    const [r] = await m.db.db.select().from(m.schema.deliveries).where(eq(m.schema.deliveries.id, id));
    return r!;
  }

  it("manual send of a follow gate rule sends the postback template and marks it pending", async () => {
    const { rule } = await seed();
    const { eq } = await import("drizzle-orm");
    await m.db.db
      .update(m.schema.rules)
      .set({ followGateEnabled: true })
      .where(eq(m.schema.rules.id, rule.id));
    const d = await skippedRow();
    const res = await m.manual.manualSend({ deliveryId: d.id, ruleId: rule.id });
    expect(res.status).toBe("sent");
    const dm = JSON.parse(String(fetchMock.mock.calls[1]![1].body));
    expect(dm).toMatchObject({
      recipient: { comment_id: d.commentId },
      message: {
        attachment: { payload: { buttons: [{ type: "postback", payload: `fg:${d.id}` }] } },
      },
    });
    expect(await get(d.id)).toMatchObject({ status: "sent", followGateStatus: "pending" });
  });

  it("sends once on the same row with source manual and '*' as keyword; a second attempt is refused", async () => {
    const { rule } = await seed();
    const d = await skippedRow();
    const res = await m.manual.manualSend({ deliveryId: d.id, ruleId: rule.id });
    expect(res.status).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const dm = JSON.parse(String(fetchMock.mock.calls[1]![1].body));
    expect(dm).toEqual({ recipient: { comment_id: d.commentId }, message: { text: "Hi alice:" } });
    expect(await get(d.id)).toMatchObject({
      status: "sent",
      source: "manual",
      ruleId: rule.id,
      matchedKeyword: "*",
      skipReason: null,
      attempts: 1,
    });
    await expect(m.manual.manualSend({ deliveryId: d.id, ruleId: rule.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("claims atomically: concurrent sends produce exactly one private reply", async () => {
    const { rule } = await seed();
    const d = await skippedRow({ commentText: "drive" });
    const results = await Promise.allSettled([
      m.manual.manualSend({ deliveryId: d.id, ruleId: rule.id }),
      m.manual.manualSend({ deliveryId: d.id, ruleId: rule.id }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([u]) => u.pathname.endsWith("/messages"))).toHaveLength(1);
    expect((await get(d.id)).matchedKeyword).toBe("drive");
  });

  it("honours once-per-user unless overridden", async () => {
    const { rule } = await seed();
    await skippedRow({ status: "sent", skipReason: null, ruleId: rule.id });
    const d = await skippedRow();
    const blocked = await m.manual.manualSend({ deliveryId: d.id, ruleId: rule.id });
    expect(blocked).toMatchObject({ status: "skipped", skipReason: "already_delivered" });
    expect(await get(d.id)).toMatchObject({ status: "skipped", skipReason: "already_delivered" });
    expect(fetchMock).not.toHaveBeenCalled();
    const forced = await m.manual.manualSend({ deliveryId: d.id, ruleId: rule.id, ignoreOncePerUser: true });
    expect(forced.status).toBe("sent");
  });

  it("refuses old, own and paused cases without sending", async () => {
    const { rule } = await seed();
    const old = await skippedRow({ createdAt: new Date(Date.now() - 8 * 86_400_000) });
    await expect(m.manual.manualSend({ deliveryId: old.id, ruleId: rule.id })).rejects.toMatchObject({
      publicMessage: expect.stringMatching(/7 days/),
    });
    const own = await skippedRow({ skipReason: "own_comment" });
    await expect(m.manual.manualSend({ deliveryId: own.id, ruleId: rule.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    const d = await skippedRow();
    await m.settings.setSetting("processing.enabled", false);
    await expect(m.manual.manualSend({ deliveryId: d.id, ruleId: rule.id })).rejects.toMatchObject({
      publicMessage: expect.stringMatching(/paused/),
    });
    expect(await get(d.id)).toMatchObject({ status: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers the other post's rule for no_campaign_for_post rows", async () => {
    const { rule, post } = await seed();
    const d = await skippedRow({
      mediaId: "ad_id",
      commentText: "drive",
      skipReason: "no_campaign_for_post",
      campaignId: post.id,
      ruleId: rule.id,
    });
    const res = await m.manual.manualSend({ deliveryId: d.id, ruleId: rule.id });
    expect(res.status).toBe("sent");
  });

  it("sync inserts missed comments as not_delivered, skipping known and own comments", async () => {
    await seed();
    const known = await skippedRow();
    const ts = new Date(Date.now() - 3600_000)
      .toISOString()
      .replace("Z", "+0000")
      .replace(/\.\d{3}/, "");
    commentsPage = {
      data: [
        { id: known.commentId, text: "x", timestamp: ts, from: { id: "user_1", username: "alice" } },
        {
          id: "new_1",
          text: "drive",
          timestamp: ts,
          from: { id: "user_2", username: "bob" },
          replies: {
            data: [
              {
                id: "own_reply",
                text: "DM sent",
                timestamp: ts,
                from: { id: OUR_IG_ID, username: "ourbrand" },
              },
            ],
          },
        },
      ],
    };
    const res = await m.manual.syncMissedComments({});
    expect(res).toMatchObject({ posts: 1, checked: 3, added: 1, failed: 0 });
    const { eq } = await import("drizzle-orm");
    const [r] = await m.db.db
      .select()
      .from(m.schema.deliveries)
      .where(eq(m.schema.deliveries.commentId, "new_1"));
    expect(r).toMatchObject({
      status: "skipped",
      skipReason: "not_delivered",
      source: "manual",
      commenterId: "user_2",
      mediaId: MEDIA,
    });
    expect(fetchMock.mock.calls.every(([u]) => !u.pathname.endsWith("/messages"))).toBe(true);
    expect((await m.manual.syncMissedComments({})).added).toBe(0);
  });
});
