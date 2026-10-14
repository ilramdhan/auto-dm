/**
 * Postgres integration test for the analytics/dashboard queries. Uses its own database
 * (`<TEST_DATABASE_URL db>_analytics`, created on demand) so it can run in parallel with the
 * engine integration test. Skipped when TEST_DATABASE_URL is not set.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const BASE = process.env.TEST_DATABASE_URL;

describe.skipIf(!BASE)("analytics queries (Postgres integration)", () => {
  let repos: typeof import("@/server/repos/analytics");
  let stats: typeof import("@/server/repos/stats");
  let deliveriesRepo: typeof import("@/server/repos/deliveries");
  let range: typeof import("@/lib/validation/analytics").resolveRange;
  const CAMPAIGN = "11111111-1111-4111-8111-111111111111";
  const RULE = "22222222-2222-4222-8222-222222222222";
  // 2026-10-14 18:30Z = 2026-10-15 01:30 in Jakarta.
  const NOW = new Date("2026-10-14T18:30:00Z");

  beforeAll(async () => {
    const url = new URL(BASE!);
    const dbName = `${url.pathname.slice(1)}_analytics`;
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
    const sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
    await migrate(drizzle({ client: sql }), { migrationsFolder: "./drizzle/migrations" });
    await sql`truncate deliveries, rules, campaigns cascade`;
    await sql`insert into campaigns (id, name, media_id) values (${CAMPAIGN}, 'Drive reel', 'm1')`;
    await sql`insert into rules (id, campaign_id, name, keywords, dm_message)
              values (${RULE}, ${CAMPAIGN}, 'Drive', '{drive}', 'hi')`;
    const rows = [
      // 2026-10-14 16:00Z = 23:00 on the 14th in Jakarta
      ["c1", "2026-10-14T16:00:00Z", "sent", "sent", "sent", null],
      // 2026-10-14 18:00Z = 01:00 on the 15th in Jakarta (still the 14th in UTC)
      ["c2", "2026-10-14T18:00:00Z", "sent", "sent", "sent", null],
      ["c3", "2026-10-14T18:10:00Z", "failed", "sent", "failed", "551"],
      ["c4", "2026-10-13T10:00:00Z", "skipped", "not_attempted", "not_attempted", null],
    ] as const;
    for (const [id, at, status, reply, dm, code] of rows) {
      await sql`insert into deliveries (comment_id, media_id, commenter_id, campaign_id, rule_id, matched_keyword,
                  status, public_reply_status, dm_status, error_code, skip_reason, duration_ms, created_at)
                values (${id}, 'm1', ${"u-" + id}, ${CAMPAIGN}, ${RULE}, 'drive', ${status}, ${reply}, ${dm}, ${code},
                  ${status === "skipped" ? "no_match" : null}, 500, ${at})`;
    }
    await sql.end();

    repos = await import("@/server/repos/analytics");
    stats = await import("@/server/repos/stats");
    deliveriesRepo = await import("@/server/repos/deliveries");
    range = (await import("@/lib/validation/analytics")).resolveRange;
  });

  afterAll(async () => {
    await (globalThis as unknown as { __pg?: { end: () => Promise<void> } }).__pg?.end();
  });

  it("groups the daily series by calendar day in the configured time zone", async () => {
    const jakarta = await repos.getDailySeries({ range: range({ range: "7d" }, NOW, "Asia/Jakarta") });
    const byDay = Object.fromEntries(jakarta.map((p) => [p.day, p.comments]));
    expect(byDay["2026-10-15"]).toBe(2);
    expect(byDay["2026-10-14"]).toBe(1);
    expect(byDay["2026-10-13"]).toBe(1);
    expect(jakarta).toHaveLength(7);

    const utc = await repos.getDailySeries({ range: range({ range: "7d" }, NOW, "UTC") });
    expect(Object.fromEntries(utc.map((p) => [p.day, p.comments]))["2026-10-14"]).toBe(3);
  });

  it("runs every analytics aggregate without SQL errors", async () => {
    const scope = { range: range({ range: "30d" }, NOW, "Asia/Jakarta") };
    const kpis = await repos.getKpis(scope);
    expect(kpis.comments).toBe(4);
    expect(kpis.dmsSent).toBe(2);
    const [campaignRow] = await repos.getPerCampaign(scope);
    expect(campaignRow?.comments).toBe(4);
    expect((await repos.getPerPost(scope))[0]?.comments).toBe(4);
    expect((await repos.getKeywordBreakdown(scope))[0]?.keyword).toBe("drive");
    expect((await repos.getTopErrors(scope))[0]?.code).toBe("551");
    expect((await repos.getTopSkipReasons(scope))[0]?.reason).toBe("no_match");
    expect((await repos.getStatusBreakdown(scope)).length).toBeGreaterThan(0);
    expect((await repos.getKpis({ ...scope, campaignId: CAMPAIGN })).comments).toBe(4);
  });

  it("counts 'today' from local midnight on the dashboard", async () => {
    expect((await stats.getDashboardStats(NOW, "Asia/Jakarta")).commentsToday).toBe(2);
    expect((await stats.getDashboardStats(NOW, "UTC")).commentsToday).toBe(3);
    expect(await deliveriesRepo.hasAnyDelivery()).toBe(true);
    expect((await deliveriesRepo.recentDeliveries(2)).length).toBe(2);
  });
});
