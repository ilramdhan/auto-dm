/**
 * Follow gate integration tests against a real Postgres (see process-comment.test.ts for setup).
 * Skipped when TEST_DATABASE_URL is not set. Graph API calls are served by a mocked `fetch`.
 */
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentEvent, PostbackEvent } from "@/server/instagram/webhook";

const TEST_DB = process.env.TEST_DATABASE_URL;
const OUR_IG_ID = "17841400000000001";
const MEDIA = "18000000000000001";
const APP_SECRET_SETTING = "meta-app-secret-for-tests-0001";

type Mods = {
  db: typeof import("@/server/db/client");
  schema: typeof import("@/server/db/schema");
  crypto: typeof import("@/server/crypto");
  settings: typeof import("@/server/settings");
  engine: typeof import("@/server/engine/process-comment");
  gate: typeof import("@/server/engine/follow-gate");
  apiKeys: typeof import("@/server/api-keys");
  n8nRoute: typeof import("@/app/api/v1/n8n/events/route");
};

type FetchFn = (url: URL, init: RequestInit) => Promise<Response>;

describe.skipIf(!TEST_DB)("follow gate (Postgres integration)", () => {
  let m: Mods;
  let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;
  let following: boolean | "error" = true;
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
      engine: await import("@/server/engine/process-comment"),
      gate: await import("@/server/engine/follow-gate"),
      apiKeys: await import("@/server/api-keys"),
      n8nRoute: await import("@/app/api/v1/n8n/events/route"),
    };
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    const { sql } = await import("drizzle-orm");
    await m.db.db
      .execute(sql`TRUNCATE deliveries, rules, campaigns, instagram_accounts, settings, api_keys CASCADE`)
      .catch(() => undefined);
    await (globalThis as unknown as { __pg?: { end: () => Promise<void> } }).__pg?.end();
  });

  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await m.db.db.execute(
      sql`TRUNCATE deliveries, rules, campaigns, instagram_accounts, settings, api_keys CASCADE`,
    );
    following = true;
    fetchMock = vi.fn<FetchFn>(async (url: URL) => {
      seq++;
      if (url.pathname.endsWith("/replies")) return json({ id: `reply_${seq}` });
      if (url.pathname.endsWith("/messages"))
        return json({ recipient_id: "igsid", message_id: `mid_${seq}` });
      if (url.searchParams.get("fields") === "is_user_follow_business") {
        return following === "error"
          ? json({ error: { message: "(#100) Bad", code: 100 } }, 400)
          : json({ is_user_follow_business: following, id: "x" });
      }
      return json({ error: { message: "unexpected call", code: 1 } }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  async function seed(gate: boolean, button = true) {
    const { instagramAccounts, campaigns, rules } = m.schema;
    const [account] = await m.db.db
      .insert(instagramAccounts)
      .values({
        igUserId: OUR_IG_ID,
        username: "ourbrand",
        accessTokenEnc: m.crypto.encrypt("IGTOKEN_test_123456"),
      })
      .returning();
    const [c] = await m.db.db.insert(campaigns).values({ name: "All", accountId: account!.id }).returning();
    const [rule] = await m.db.db
      .insert(rules)
      .values({
        campaignId: c!.id,
        name: "drive",
        keywords: ["drive"],
        publicReplies: [],
        dmMessage: "Hi {username}! Here's the {keyword}",
        dmButtonTitle: button ? "Open" : null,
        dmButtonUrl: button ? "https://example.com/x" : null,
        followGateEnabled: gate,
        followGateRetryMessage: gate ? "Belum follow, {username}" : null,
      })
      .returning();
    return { rule: rule! };
  }

  let commentSeq = 0;
  const event = (over: Partial<CommentEvent> = {}): CommentEvent => ({
    commentId: `fg_c_${++commentSeq}`,
    text: "drive",
    igUserId: OUR_IG_ID,
    fromId: "igsid_1",
    fromUsername: "alice",
    mediaId: MEDIA,
    mediaProductType: "REELS",
    parentId: null,
    ...over,
  });
  const tap = (deliveryId: string, over: Partial<PostbackEvent> = {}): PostbackEvent => ({
    igUserId: OUR_IG_ID,
    senderId: "igsid_1",
    recipientId: OUR_IG_ID,
    payload: `fg:${deliveryId}`,
    mid: `mid_tap_${++seq}`,
    timestamp: Date.now(),
    ...over,
  });
  const bodies = () =>
    fetchMock.mock.calls
      .filter(([u]) => u.pathname.endsWith("/messages"))
      .map(([, init]) => JSON.parse(String(init.body)) as Record<string, unknown>);
  async function row(id: string) {
    const { eq } = await import("drizzle-orm");
    const [r] = await m.db.db.select().from(m.schema.deliveries).where(eq(m.schema.deliveries.id, id));
    return r!;
  }

  it("gate disabled: same Private Reply as before and no follow gate state", async () => {
    await seed(false);
    const e = event();
    const res = await m.engine.processCommentEvent(e, { source: "webhook" });
    expect(res.status).toBe("sent");
    expect(bodies()).toEqual([
      {
        recipient: { comment_id: e.commentId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: "Hi alice! Here's the drive",
              buttons: [{ type: "web_url", url: "https://example.com/x", title: "Open" }],
            },
          },
        },
      },
    ]);
    const r = await row(res.deliveryId!);
    expect(r.followGateStatus).toBeNull();
    expect(r.followGateUnlockedAt).toBeNull();
  });

  it("gate enabled: sends the postback template and marks the delivery pending", async () => {
    await seed(true);
    const e = event();
    const res = await m.engine.processCommentEvent(e, { source: "webhook" });
    expect(res.status).toBe("sent");
    expect(bodies()).toEqual([
      {
        recipient: { comment_id: e.commentId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: "Hai alice! Follow akun kami dulu ya, lalu klik tombol di bawah untuk mendapatkan link-nya.",
              buttons: [{ type: "postback", title: "Saya sudah follow", payload: `fg:${res.deliveryId}` }],
            },
          },
        },
      },
    ]);
    const r = await row(res.deliveryId!);
    expect(r).toMatchObject({ status: "sent", dmStatus: "sent", followGateStatus: "pending" });
  });

  it("following: unlocks once and sends the real DM to recipient.id; repeat taps are ignored", async () => {
    await seed(true);
    const res = await m.engine.processCommentEvent(event(), { source: "webhook" });
    fetchMock.mockClear();
    const outcomes = await Promise.all([
      m.gate.handleFollowGatePostback(tap(res.deliveryId!)),
      m.gate.handleFollowGatePostback(tap(res.deliveryId!)),
    ]);
    expect(outcomes.sort()).toEqual(["ignored_not_pending", "unlocked"]);
    const sent = bodies();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      recipient: { id: "igsid_1" },
      message: { attachment: { payload: { text: "Hi alice! Here's the drive" } } },
    });
    const r = await row(res.deliveryId!);
    expect(r.followGateStatus).toBe("unlocked");
    expect(r.followGateUnlockedAt).toBeInstanceOf(Date);
    await expect(m.gate.handleFollowGatePostback(tap(res.deliveryId!))).resolves.toBe("ignored_not_pending");
    expect(bodies()).toHaveLength(1);
  });

  it("not following: sends the retry text with the same button and stays pending", async () => {
    await seed(true);
    const res = await m.engine.processCommentEvent(event(), { source: "webhook" });
    fetchMock.mockClear();
    following = false;
    await expect(m.gate.handleFollowGatePostback(tap(res.deliveryId!))).resolves.toBe("not_following");
    expect(bodies()).toEqual([
      {
        recipient: { id: "igsid_1" },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: "Belum follow, alice",
              buttons: [{ type: "postback", title: "Saya sudah follow", payload: `fg:${res.deliveryId}` }],
            },
          },
        },
      },
    ]);
    expect((await row(res.deliveryId!)).followGateStatus).toBe("pending");
  });

  it("follow check error: fails open", async () => {
    await seed(true);
    const res = await m.engine.processCommentEvent(event(), { source: "webhook" });
    following = "error";
    await expect(m.gate.handleFollowGatePostback(tap(res.deliveryId!))).resolves.toBe("unlocked_fail_open");
    expect((await row(res.deliveryId!)).followGateStatus).toBe("unlocked");
  });

  it("sender mismatch and deleted rule are ignored", async () => {
    const { rule } = await seed(true);
    const res = await m.engine.processCommentEvent(event(), { source: "webhook" });
    fetchMock.mockClear();
    await expect(
      m.gate.handleFollowGatePostback(tap(res.deliveryId!, { senderId: "intruder" })),
    ).resolves.toBe("ignored_sender_mismatch");
    const { eq } = await import("drizzle-orm");
    await m.db.db.delete(m.schema.rules).where(eq(m.schema.rules.id, rule.id));
    await expect(m.gate.handleFollowGatePostback(tap(res.deliveryId!))).resolves.toBe("ignored_rule_deleted");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("n8n relay accepts a postback-only payload and keeps its response shape", async () => {
    await seed(true);
    const res = await m.engine.processCommentEvent(event(), { source: "webhook" });
    fetchMock.mockClear();
    await m.settings.setSetting("meta.appSecret", APP_SECRET_SETTING);
    const { key } = await m.apiKeys.createApiKey("n8n");
    const body = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: OUR_IG_ID,
          time: 1,
          messaging: [
            {
              sender: { id: "igsid_1" },
              recipient: { id: OUR_IG_ID },
              timestamp: 1,
              postback: { mid: "pb1", title: "Saya sudah follow", payload: `fg:${res.deliveryId}` },
            },
          ],
        },
      ],
    });
    const sig = `sha256=${createHmac("sha256", APP_SECRET_SETTING).update(body).digest("hex")}`;
    const { NextRequest } = await import("next/server");
    const resp = await m.n8nRoute.POST(
      new NextRequest("http://localhost/api/v1/n8n/events", {
        method: "POST",
        body,
        headers: { authorization: `Bearer ${key}`, "x-hub-signature-256": sig },
      }),
    );
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ results: [] });
    expect((await row(res.deliveryId!)).followGateStatus).toBe("unlocked");
  });
});
