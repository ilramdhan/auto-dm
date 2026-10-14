/**
 * Integration tests for the comment pipeline against a real Postgres.
 *
 * Run (uses its own database; it is wiped between tests):
 *   psql postgres://autodm:autodm@127.0.0.1:5432/postgres -c 'CREATE DATABASE autodm_engine_test'
 *   TEST_DATABASE_URL=postgres://autodm:autodm@127.0.0.1:5432/autodm_engine_test \
 *   APP_SECRET=dev-secret-dev-secret-dev-secret-dev-secret pnpm test tests/engine
 *
 * Skipped when TEST_DATABASE_URL is not set. Graph API calls are served by a mocked `fetch`.
 */
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentEvent } from "@/server/instagram/webhook";

const TEST_DB = process.env.TEST_DATABASE_URL;
const APP_SECRET_SETTING = "meta-app-secret-for-tests-0001";
const OUR_IG_ID = "17841400000000001";
const MEDIA = "18000000000000001";

type Mods = {
  db: typeof import("@/server/db/client");
  schema: typeof import("@/server/db/schema");
  crypto: typeof import("@/server/crypto");
  settings: typeof import("@/server/settings");
  engine: typeof import("@/server/engine/process-comment");
  apiKeys: typeof import("@/server/api-keys");
  n8nRoute: typeof import("@/app/api/v1/n8n/events/route");
};

describe.skipIf(!TEST_DB)("processCommentEvent (Postgres integration)", () => {
  let m: Mods;
  let fetchMock: ReturnType<typeof vi.fn<(url: URL, init: RequestInit) => Promise<Response>>>;
  let failDm = false;
  let seq = 0;

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
      engine: await import("@/server/engine/process-comment"),
      apiKeys: await import("@/server/api-keys"),
      n8nRoute: await import("@/app/api/v1/n8n/events/route"),
    };
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await (globalThis as unknown as { __pg?: { end: () => Promise<void> } }).__pg?.end();
  });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  beforeEach(async () => {
    const { db } = m.db;
    const { sql } = await import("drizzle-orm");
    await db.execute(
      sql`TRUNCATE deliveries, rules, campaigns, instagram_accounts, settings, api_keys CASCADE`,
    );
    failDm = false;
    fetchMock = vi.fn(async (url: URL) => {
      seq++;
      if (url.pathname.endsWith("/replies")) return json({ id: `reply_${seq}` });
      if (url.pathname.endsWith("/messages")) {
        return failDm
          ? json({ error: { message: "(#10) Outside of allowed window", code: 10, fbtrace_id: "T1" } }, 400)
          : json({ recipient_id: "igsid", message_id: `mid_${seq}` });
      }
      return json({ error: { message: "unexpected call", code: 1 } }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  async function seed(opts: { mediaCampaign?: boolean } = {}) {
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
    const [all] = await db
      .insert(campaigns)
      .values({ name: "All posts", accountId: account!.id })
      .returning();
    const [driveRule] = await db
      .insert(rules)
      .values({
        campaignId: all!.id,
        name: "drive",
        keywords: ["drive", "link"],
        publicReplies: ["Sent, check your DM @{username}!"],
        dmMessage: "Hi {username}! Here's the {keyword}: https://example.com",
      })
      .returning();
    let postRule: typeof driveRule;
    if (opts.mediaCampaign) {
      const [post] = await db.insert(campaigns).values({ name: "Reel", mediaId: MEDIA }).returning();
      [postRule] = await db
        .insert(rules)
        .values({
          campaignId: post!.id,
          name: "reel drive",
          keywords: ["drive"],
          dmMessage: "Reel link",
          priority: -5,
        })
        .returning();
    }
    return { account: account!, driveRule: driveRule!, postRule };
  }

  let commentSeq = 0;
  const event = (over: Partial<CommentEvent> = {}): CommentEvent => ({
    commentId: `c_${++commentSeq}`,
    text: "DRIVE 🙏",
    igUserId: OUR_IG_ID,
    fromId: "user_1",
    fromUsername: "alice",
    mediaId: MEDIA,
    mediaProductType: "REELS",
    parentId: null,
    ...over,
  });

  async function row(commentId: string) {
    const { eq } = await import("drizzle-orm");
    const [r] = await m.db.db
      .select()
      .from(m.schema.deliveries)
      .where(eq(m.schema.deliveries.commentId, commentId));
    return r!;
  }

  it("sends a public reply and a private reply and records the delivery", async () => {
    const { driveRule } = await seed();
    const e = event();
    const res = await m.engine.processCommentEvent(e, { source: "webhook" });
    expect(res).toMatchObject({
      status: "sent",
      ruleId: driveRule.id,
      matchedKeyword: "drive",
      skipReason: null,
      error: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [replyUrl, replyInit] = fetchMock.mock.calls[0]!;
    expect(replyUrl.pathname).toMatch(new RegExp(`/${e.commentId}/replies$`));
    expect(String(replyInit.body)).toBe(
      new URLSearchParams({ message: "Sent, check your DM @alice!" }).toString(),
    );
    const [dmUrl, dmInit] = fetchMock.mock.calls[1]!;
    expect(dmUrl.pathname).toMatch(new RegExp(`/${OUR_IG_ID}/messages$`));
    expect(JSON.parse(String(dmInit.body))).toEqual({
      recipient: { comment_id: e.commentId },
      message: { text: "Hi alice! Here's the drive: https://example.com" },
    });

    const r = await row(e.commentId);
    expect(r).toMatchObject({
      status: "sent",
      publicReplyStatus: "sent",
      dmStatus: "sent",
      ruleId: driveRule.id,
      matchedKeyword: "drive",
      source: "webhook",
      attempts: 1,
      errorCode: null,
    });
    expect(r.publicReplyId).toMatch(/^reply_/);
    expect(r.dmMessageId).toMatch(/^mid_/);
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
    expect(r.processedAt).toBeInstanceOf(Date);
  });

  it("is idempotent: the same comment twice yields one delivery and one set of sends", async () => {
    await seed();
    const e = event();
    const first = await m.engine.processCommentEvent(e, { source: "webhook" });
    const second = await m.engine.processCommentEvent(e, { source: "n8n" });
    expect(first.status).toBe("sent");
    expect(second.status).toBe("duplicate");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const rows = await m.db.db.select().from(m.schema.deliveries);
    expect(rows).toHaveLength(1);
  });

  it("enforces once-per-user per rule", async () => {
    await seed();
    await m.engine.processCommentEvent(event(), { source: "webhook" });
    const again = await m.engine.processCommentEvent(event({ text: "link please" }), { source: "webhook" });
    expect(again).toMatchObject({ status: "skipped", skipReason: "already_delivered" });
    const other = await m.engine.processCommentEvent(event({ fromId: "user_2", fromUsername: "bob" }), {
      source: "webhook",
    });
    expect(other.status).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("enforces once-per-user under concurrency", async () => {
    await seed();
    const results = await Promise.all(
      [1, 2, 3, 4].map(() => m.engine.processCommentEvent(event(), { source: "webhook" })),
    );
    expect(results.filter((r) => r.status === "sent")).toHaveLength(1);
    expect(results.filter((r) => r.skipReason === "already_delivered")).toHaveLength(3);
  });

  it("allows repeat deliveries when once-per-user is off", async () => {
    const { driveRule } = await seed();
    const { eq } = await import("drizzle-orm");
    await m.db.db
      .update(m.schema.rules)
      .set({ oncePerUser: false })
      .where(eq(m.schema.rules.id, driveRule.id));
    await m.engine.processCommentEvent(event(), { source: "webhook" });
    expect((await m.engine.processCommentEvent(event(), { source: "webhook" })).status).toBe("sent");
  });

  it.each([
    ["own_comment (by id)", { fromId: OUR_IG_ID, fromUsername: "ourbrand" }],
    ["own_comment (by username)", { fromId: "other-scoped-id", fromUsername: "OurBrand" }],
  ])("skips %s — loop protection", async (_label, over) => {
    await seed();
    const e = event({ ...over, parentId: "c_parent" });
    const res = await m.engine.processCommentEvent(e, { source: "webhook" });
    expect(res).toMatchObject({ status: "skipped", skipReason: "own_comment" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips non-matching, empty and foreign-account comments", async () => {
    await seed();
    expect(
      (await m.engine.processCommentEvent(event({ text: "nice reel" }), { source: "webhook" })).skipReason,
    ).toBe("no_match");
    expect(
      (await m.engine.processCommentEvent(event({ text: "  " }), { source: "webhook" })).skipReason,
    ).toBe("empty_comment");
    expect(
      (await m.engine.processCommentEvent(event({ igUserId: "999" }), { source: "webhook" })).skipReason,
    ).toBe("account_mismatch");
    expect(fetchMock).not.toHaveBeenCalled();
    const r = await row(`c_${commentSeq - 2}`);
    expect(r).toMatchObject({
      status: "skipped",
      skipReason: "no_match",
      publicReplyStatus: "not_attempted",
      dmStatus: "not_attempted",
    });
  });

  it("skips when no account is connected", async () => {
    const res = await m.engine.processCommentEvent(event(), { source: "webhook" });
    expect(res).toMatchObject({ status: "skipped", skipReason: "no_account" });
  });

  it("logs only (records the match) when processing is disabled", async () => {
    const { driveRule } = await seed();
    await m.settings.setSetting("processing.enabled", false);
    const res = await m.engine.processCommentEvent(event(), { source: "webhook" });
    expect(res).toMatchObject({
      status: "skipped",
      skipReason: "processing_disabled",
      ruleId: driveRule.id,
      matchedKeyword: "drive",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores campaigns outside their date window", async () => {
    await seed();
    const { campaigns } = m.schema;
    await m.db.db.update(campaigns).set({ endsAt: new Date(Date.now() - 1000) });
    expect((await m.engine.processCommentEvent(event(), { source: "webhook" })).skipReason).toBe("no_match");
    await m.db.db.update(campaigns).set({ endsAt: null, startsAt: new Date(Date.now() + 60_000) });
    expect((await m.engine.processCommentEvent(event(), { source: "webhook" })).skipReason).toBe("no_match");
  });

  it("prefers the media-specific campaign over 'all posts'", async () => {
    const { postRule } = await seed({ mediaCampaign: true });
    const res = await m.engine.processCommentEvent(event(), { source: "webhook" });
    expect(res.ruleId).toBe(postRule!.id);
    // No public reply variants on that rule → only the DM is sent.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const other = await m.engine.processCommentEvent(event({ mediaId: "another", fromId: "u9" }), {
      source: "webhook",
    });
    expect(other.ruleId).not.toBe(postRule!.id);
  });

  it("records partial delivery with the Graph error code when the DM fails", async () => {
    await seed();
    failDm = true;
    const e = event();
    const res = await m.engine.processCommentEvent(e, { source: "webhook" });
    expect(res.status).toBe("partial");
    expect(res.errorCode).toBe("10");
    const r = await row(e.commentId);
    expect(r).toMatchObject({
      status: "partial",
      publicReplyStatus: "sent",
      dmStatus: "failed",
      errorCode: "10",
    });
    expect(r.error).toContain("private reply");
    expect(r.error).not.toContain("IGTOKEN");
  });

  describe("api keys + n8n relay route", () => {
    it("creates, verifies and revokes API keys", async () => {
      const { id, key } = await m.apiKeys.createApiKey("n8n");
      expect(key).toMatch(/^ard_[A-Za-z0-9_-]{43}$/);
      expect(await m.apiKeys.verifyApiKey(`Bearer ${key}`)).toEqual({ id, name: "n8n" });
      expect(await m.apiKeys.verifyApiKey(`Bearer ${key}x`)).toBeNull();
      expect(await m.apiKeys.verifyApiKey(key)).toBeNull();
      const [listed] = await m.apiKeys.listApiKeys();
      expect(listed).toMatchObject({ id, name: "n8n", prefix: key.slice(0, 12), revokedAt: null });
      expect(listed!.lastUsedAt).toBeInstanceOf(Date);
      expect(listed).not.toHaveProperty("keyHash");
      expect(await m.apiKeys.revokeApiKey(id)).toBe(true);
      expect(await m.apiKeys.revokeApiKey(id)).toBe(false);
      expect(await m.apiKeys.verifyApiKey(`Bearer ${key}`)).toBeNull();
    });

    it("POST /api/v1/n8n/events processes a signed relayed payload", async () => {
      const { driveRule } = await seed();
      await m.settings.setSetting("meta.appSecret", APP_SECRET_SETTING);
      const { key } = await m.apiKeys.createApiKey("n8n");
      const raw = JSON.stringify({
        object: "instagram",
        entry: [
          {
            id: OUR_IG_ID,
            time: 1,
            changes: [
              {
                field: "comments",
                value: {
                  id: "n8n_c1",
                  text: "link pls",
                  from: { id: "u5", username: "eve" },
                  media: { id: MEDIA },
                },
              },
            ],
          },
        ],
      });
      const sig = `sha256=${createHmac("sha256", APP_SECRET_SETTING).update(raw).digest("hex")}`;
      const req = (headers: Record<string, string>) =>
        new Request("http://localhost/api/v1/n8n/events", { method: "POST", body: raw, headers }) as never;

      const ok = await m.n8nRoute.POST(req({ authorization: `Bearer ${key}`, "x-hub-signature-256": sig }));
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({
        results: [
          {
            commentId: "n8n_c1",
            status: "sent",
            ruleId: driveRule.id,
            matchedKeyword: "link",
            skipReason: null,
            error: null,
          },
        ],
      });

      const dup = await m.n8nRoute.POST(req({ authorization: `Bearer ${key}`, "x-hub-signature-256": sig }));
      expect((await dup.json()).results[0].status).toBe("duplicate");

      const badSig = await m.n8nRoute.POST(
        req({ authorization: `Bearer ${key}`, "x-hub-signature-256": "sha256=" + "0".repeat(64) }),
      );
      expect(badSig.status).toBe(401);
      expect((await badSig.json()).error.code).toBe("UNAUTHORIZED");

      const badKey = await m.n8nRoute.POST(
        req({ authorization: "Bearer ard_nope", "x-hub-signature-256": sig }),
      );
      expect(badKey.status).toBe(401);
    });
  });
});
