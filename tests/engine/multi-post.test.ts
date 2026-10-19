/**
 * Integration tests for multi-post campaigns (`campaigns.media_ids`, #98) against a real Postgres:
 * backfill, targeting SQL, the comment pipeline, "Add this post to campaign" and missed-comment sync.
 * Skipped when TEST_DATABASE_URL is not set (see tests/engine/process-comment.test.ts for setup).
 * Graph API calls are served by a mocked `fetch`.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentEvent } from "@/server/instagram/webhook";

const TEST_DB = process.env.TEST_DATABASE_URL;
const OUR_IG_ID = "17841400000000001";
const ORGANIC = "18000000000000001";
const AD = "18000000000000002";
const OTHER = "18000000000000003";

type Mods = {
  db: typeof import("@/server/db/client");
  schema: typeof import("@/server/db/schema");
  crypto: typeof import("@/server/crypto");
  resolve: typeof import("@/server/engine/resolve");
  engine: typeof import("@/server/engine/process-comment");
  manual: typeof import("@/server/engine/manual-send");
  campaignsRepo: typeof import("@/server/repos/campaigns");
  validation: typeof import("@/lib/validation/campaign");
};

describe.skipIf(!TEST_DB)("multi-post campaigns (Postgres integration)", () => {
  let m: Mods;
  let fetchMock: ReturnType<typeof vi.fn<(url: URL, init: RequestInit) => Promise<Response>>>;
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
      resolve: await import("@/server/engine/resolve"),
      engine: await import("@/server/engine/process-comment"),
      manual: await import("@/server/engine/manual-send"),
      campaignsRepo: await import("@/server/repos/campaigns"),
      validation: await import("@/lib/validation/campaign"),
    };
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await (globalThis as unknown as { __pg?: { end: () => Promise<void> } }).__pg?.end();
  });

  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await m.db.db.execute(sql`TRUNCATE deliveries, rules, campaigns, instagram_accounts, settings CASCADE`);
    fetchMock = vi.fn(async (url: URL) => {
      seq++;
      if (url.pathname.endsWith("/replies")) return json({ id: `reply_${seq}` });
      if (url.pathname.endsWith("/messages"))
        return json({ recipient_id: "igsid", message_id: `mid_${seq}` });
      if (url.pathname.endsWith("/comments")) return json({ data: [] });
      return json({ error: { message: "unexpected call", code: 1 } }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  async function account() {
    const [a] = await m.db.db
      .insert(m.schema.instagramAccounts)
      .values({
        igUserId: OUR_IG_ID,
        username: "ourbrand",
        accessTokenEnc: m.crypto.encrypt("IGTOKEN_test_123456"),
      })
      .returning();
    return a!;
  }

  async function campaign(
    values: { name: string; mediaId?: string | null; mediaIds?: string[] | null },
    keywords = ["craft"],
  ) {
    const [c] = await m.db.db.insert(m.schema.campaigns).values(values).returning();
    const [r] = await m.db.db
      .insert(m.schema.rules)
      .values({ campaignId: c!.id, name: `${values.name} rule`, keywords, dmMessage: "Link: {keyword}" })
      .returning();
    return { campaign: c!, rule: r! };
  }

  async function reload(id: string) {
    const { eq } = await import("drizzle-orm");
    const [c] = await m.db.db.select().from(m.schema.campaigns).where(eq(m.schema.campaigns.id, id));
    return c!;
  }

  let commentSeq = 0;
  const event = (over: Partial<CommentEvent> = {}): CommentEvent => ({
    commentId: `mp_${++commentSeq}`,
    text: "CRAFT 🙏",
    igUserId: OUR_IG_ID,
    fromId: "user_1",
    fromUsername: "alice",
    mediaId: ORGANIC,
    mediaProductType: "REELS",
    parentId: null,
    ...over,
  });

  it("backfill migration copies media_id into media_ids and is idempotent", async () => {
    const legacy = await campaign({ name: "Legacy", mediaId: ORGANIC });
    const all = await campaign({ name: "All" });
    const multi = await campaign({ name: "Multi", mediaId: ORGANIC, mediaIds: [ORGANIC, AD] });
    expect((await reload(legacy.campaign.id)).mediaIds).toBeNull();
    const backfill = readFileSync("./drizzle/migrations/0009_campaign_media_ids_backfill.sql", "utf8");
    const { sql } = await import("drizzle-orm");
    for (let i = 0; i < 2; i++) await m.db.db.execute(sql.raw(backfill));
    expect(await reload(legacy.campaign.id)).toMatchObject({ mediaId: ORGANIC, mediaIds: [ORGANIC] });
    expect(await reload(all.campaign.id)).toMatchObject({ mediaId: null, mediaIds: null });
    expect(await reload(multi.campaign.id)).toMatchObject({ mediaIds: [ORGANIC, AD] });
  });

  it("loadApplicableCampaigns: legacy, backfilled, multi-post and all-posts rows, post-specific first", async () => {
    const a = await account();
    // Created in this order (the engine orders by created_at within a tier).
    await campaign({ name: "All" });
    await campaign({ name: "Legacy", mediaId: ORGANIC });
    await campaign({ name: "Backfilled", mediaId: ORGANIC, mediaIds: [ORGANIC] });
    await campaign({ name: "Multi", mediaId: ORGANIC, mediaIds: [ORGANIC, AD] });
    await campaign({ name: "Empty array", mediaId: null, mediaIds: [] });
    const names = async (mediaId: string | null) =>
      (await m.resolve.loadApplicableCampaigns({ accountId: a.id, mediaId })).map((c) => c.campaign.name);
    expect(await names(ORGANIC)).toEqual(["Legacy", "Backfilled", "Multi", "All", "Empty array"]);
    expect(await names(AD)).toEqual(["Multi", "All", "Empty array"]);
    expect(await names(OTHER)).toEqual(["All", "Empty array"]);
    expect(await names(null)).toEqual(["All", "Empty array"]);

    // Other-post lookup (no_campaign_for_post) excludes campaigns that target the post in any slot.
    const others = async (mediaId: string | null) =>
      (await m.resolve.loadOtherPostCampaigns({ accountId: a.id, mediaId })).map((c) => c.campaign.name);
    expect(await others(AD)).toEqual(["Legacy", "Backfilled"]);
    expect(await others(OTHER)).toEqual(["Legacy", "Backfilled", "Multi"]);
    expect(await others(null)).toEqual(["Legacy", "Backfilled", "Multi"]);
  });

  it("regression: a legacy single-post campaign still answers its post and flags the ad id", async () => {
    await account();
    const { rule } = await campaign({ name: "Reel", mediaId: ORGANIC });
    const sent = await m.engine.processCommentEvent(event(), { source: "webhook" });
    expect(sent).toMatchObject({ status: "sent", ruleId: rule.id });
    const ad = await m.engine.processCommentEvent(event({ mediaId: AD }), { source: "webhook" });
    expect(ad).toMatchObject({ status: "skipped", skipReason: "no_campaign_for_post", ruleId: rule.id });
  });

  it("a multi-post campaign answers comments on the ad version of the reel", async () => {
    await account();
    const { rule } = await campaign({ name: "Reel", mediaId: ORGANIC, mediaIds: [ORGANIC, AD] });
    const res = await m.engine.processCommentEvent(event({ mediaId: AD }), { source: "webhook" });
    expect(res).toMatchObject({ status: "sent", ruleId: rule.id, matchedKeyword: "craft" });
    const other = await m.engine.processCommentEvent(event({ mediaId: OTHER }), { source: "webhook" });
    expect(other).toMatchObject({ status: "skipped", skipReason: "no_campaign_for_post" });
  });

  it("create/update keep media_id mirroring media_ids[0]; all posts clears both", async () => {
    const data = m.validation.campaignSchema.parse({
      name: "Multi",
      target: "media",
      mediaIds: [AD, ORGANIC],
      isActive: true,
    });
    const created = await m.campaignsRepo.createCampaign(data, null);
    expect(created).toMatchObject({ mediaId: AD, mediaIds: [AD, ORGANIC] });
    const legacyInput = m.validation.campaignSchema.parse({
      name: "Multi",
      target: "media",
      mediaId: ORGANIC,
      isActive: true,
    });
    expect(await m.campaignsRepo.updateCampaign(created.id, legacyInput)).toMatchObject({
      mediaId: ORGANIC,
      mediaIds: [ORGANIC],
    });
    const allPosts = m.validation.campaignSchema.parse({ name: "Multi", target: "all", isActive: true });
    expect(await m.campaignsRepo.updateCampaign(created.id, allPosts)).toMatchObject({
      mediaId: null,
      mediaIds: null,
    });
  });

  it("addMediaToCampaign appends once (also under concurrency) and refuses all-posts / full / missing", async () => {
    const legacy = await campaign({ name: "Legacy", mediaId: ORGANIC });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => m.campaignsRepo.addMediaToCampaign(legacy.campaign.id, AD)),
    );
    expect(results.filter((r) => r === "added")).toHaveLength(1);
    expect(results.filter((r) => r === "already")).toHaveLength(4);
    expect(await reload(legacy.campaign.id)).toMatchObject({ mediaId: ORGANIC, mediaIds: [ORGANIC, AD] });
    expect(await m.campaignsRepo.addMediaToCampaign(legacy.campaign.id, ORGANIC)).toBe("already");

    const all = await campaign({ name: "All" });
    expect(await m.campaignsRepo.addMediaToCampaign(all.campaign.id, AD)).toBe("all_posts");
    expect(await reload(all.campaign.id)).toMatchObject({ mediaId: null, mediaIds: null });

    const max = m.validation.MAX_CAMPAIGN_MEDIA;
    const ids = Array.from({ length: max }, (_, i) => `m${i}`);
    const full = await campaign({ name: "Full", mediaId: ids[0], mediaIds: ids });
    expect(await m.campaignsRepo.addMediaToCampaign(full.campaign.id, AD)).toBe("full");

    expect(await m.campaignsRepo.addMediaToCampaign("00000000-0000-4000-8000-000000000000", AD)).toBe(
      "not_found",
    );
  });

  it("after adding the ad post, the skipped row can still be sent manually and new comments are answered", async () => {
    await account();
    const { campaign: c, rule } = await campaign({ name: "Reel", mediaId: ORGANIC, mediaIds: [ORGANIC] });
    const skipped = await m.engine.processCommentEvent(event({ mediaId: AD }), { source: "webhook" });
    expect(skipped).toMatchObject({ skipReason: "no_campaign_for_post" });
    expect(await m.campaignsRepo.addMediaToCampaign(c.id, AD)).toBe("added");

    const { eq } = await import("drizzle-orm");
    const [row] = await m.db.db
      .select()
      .from(m.schema.deliveries)
      .where(eq(m.schema.deliveries.commentId, skipped.commentId));
    expect(row).toMatchObject({ status: "skipped", skipReason: "no_campaign_for_post" });
    const manual = await m.manual.manualSend({ deliveryId: row!.id, ruleId: rule.id });
    expect(manual.status).toBe("sent");

    const next = await m.engine.processCommentEvent(event({ mediaId: AD, fromId: "user_2" }), {
      source: "webhook",
    });
    expect(next).toMatchObject({ status: "sent", ruleId: rule.id });
  });

  it("missed-comment sync reads every post of a multi-post campaign once", async () => {
    await account();
    await campaign({ name: "Reel", mediaId: ORGANIC, mediaIds: [ORGANIC, AD] });
    await campaign({ name: "Legacy", mediaId: ORGANIC });
    await campaign({ name: "All" });
    const res = await m.manual.syncMissedComments({});
    expect(res).toMatchObject({ posts: 2, failed: 0 });
    const posts = fetchMock.mock.calls.map(([u]) => u.pathname.split("/").at(-2)).sort();
    expect(posts).toEqual([ORGANIC, AD].sort());
  });
});
