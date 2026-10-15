/**
 * Postgres integration test for the Activity / Analytics CSV export route handlers. Uses its own
 * database (`<TEST_DATABASE_URL db>_csv`, created on demand). Skipped when TEST_DATABASE_URL is unset.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const BASE = process.env.TEST_DATABASE_URL;

const requireUser = vi.fn(async () => ({ id: "test-user" }));
vi.mock("@/server/auth/guard", () => ({ requireUser: () => requireUser() }));
vi.mock("@/server/settings", () => ({ getTimeZone: async () => "Asia/Jakarta" }));

describe.skipIf(!BASE)("CSV export routes (Postgres integration)", () => {
  const CAMPAIGN = "33333333-3333-4333-8333-333333333333";
  const RULE = "44444444-4444-4444-8444-444444444444";
  let activity: typeof import("@/app/(dashboard)/activity/export/route");
  let analytics: typeof import("@/app/(dashboard)/analytics/export/route");
  let NextRequest: typeof import("next/server").NextRequest;

  const get = (path: string) => new NextRequest(`http://localhost${path}`);
  /** Response.text() strips a leading BOM, so check the raw bytes and decode without stripping. */
  const body = async (res: Response) => {
    const bytes = new Uint8Array(await res.arrayBuffer());
    return new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
  };

  beforeAll(async () => {
    const url = new URL(BASE!);
    const dbName = `${url.pathname.slice(1)}_csv`;
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
    await sql`insert into campaigns (id, name, media_id) values (${CAMPAIGN}, 'Drive, "reel"', 'm1')`;
    await sql`insert into rules (id, campaign_id, name, keywords, dm_message)
              values (${RULE}, ${CAMPAIGN}, 'Drive', '{drive}', 'hi')`;
    const rows = [
      // 2026-10-14 18:00Z = 2026-10-15 01:00 in Jakarta
      ["x1", "2026-10-14T18:00:00Z", "sent", '=HYPERLINK("http://evil")', "alice"],
      ["x2", "2026-10-14T19:00:00Z", "skipped", "halo, kopi ☕\nbaris dua", "bob"],
    ] as const;
    for (const [id, at, status, text, user] of rows) {
      await sql`insert into deliveries (comment_id, media_id, commenter_id, commenter_username, comment_text,
                  campaign_id, rule_id, matched_keyword, status, created_at)
                values (${id}, 'm1', ${"u-" + id}, ${user}, ${text}, ${CAMPAIGN}, ${RULE}, 'drive', ${status}, ${at})`;
    }
    await sql.end();

    ({ NextRequest } = await import("next/server"));
    activity = await import("@/app/(dashboard)/activity/export/route");
    analytics = await import("@/app/(dashboard)/analytics/export/route");
  });

  afterAll(async () => {
    await (globalThis as unknown as { __pg?: { end: () => Promise<void> } }).__pg?.end();
  });

  it("exports activity with headers, BOM, quoting, formula guard and zoned dates", async () => {
    const res = await activity.GET(get("/activity/export"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="[a-z0-9-]+-activity-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    const text = await body(res);
    expect(text.startsWith("﻿")).toBe(true);
    expect(text).toContain("time (Asia/Jakarta)");
    expect(text).toContain('2026-10-15 01:00:00,alice,"\'=HYPERLINK(""http://evil"")"');
    expect(text).toContain('"halo, kopi ☕\nbaris dua"');
    expect(text).toContain('"Drive, ""reel"""');
    expect(text.split("\r\n").filter(Boolean)).toHaveLength(3); // header + 2 rows (the cell newline is a bare LF)
  });

  it("honors the activity filters", async () => {
    const res = await activity.GET(get("/activity/export?status=skipped&q=bob"));
    const lines = (await body(res)).split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(2); // header + bob
    const none = await activity.GET(get("/activity/export?q=nobody"));
    expect((await body(none)).split("\r\n").filter(Boolean)).toHaveLength(1);
  });

  it("exports analytics per campaign and per post", async () => {
    const res = await analytics.GET(get("/analytics/export?range=90d&group=campaign"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toMatch(/filename="[a-z0-9-]+-analytics-campaign-/);
    const text = await body(res);
    expect(text.startsWith("﻿")).toBe(true);
    expect(text).toContain('"Drive, ""reel"""');
    const post = await analytics.GET(get("/analytics/export?range=90d&group=post"));
    expect(await body(post)).toContain("m1");
  });

  it("requires authentication", async () => {
    requireUser.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(activity.GET(get("/activity/export"))).rejects.toThrow("NEXT_REDIRECT");
    requireUser.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(analytics.GET(get("/analytics/export"))).rejects.toThrow("NEXT_REDIRECT");
  });
});
