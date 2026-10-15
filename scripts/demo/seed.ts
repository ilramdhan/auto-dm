/**
 * Demo data for screenshots (docs/assets/screenshots). Everything here is FAKE: a made-up
 * `@yourbrand` account with a dummy token, three campaigns and ~150 comments from invented
 * usernames over the last 14 days. Nothing talks to Instagram.
 *
 *   createdb autodm_demo
 *   DATABASE_URL=postgres://.../autodm_demo pnpm db:migrate
 *   DATABASE_URL=postgres://.../autodm_demo pnpm demo:seed
 *
 * It WIPES the app tables of the target database first, so it refuses to run unless the database
 * name contains "demo" (pass --force to override). Reads DATABASE_URL and APP_SECRET from the
 * environment or .env.local / .env. Log in afterwards as `admin` with DEMO_PASSWORD
 * (default `demo-password-2026`). Output is deterministic apart from timestamps (relative to now).
 */
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import type { NewCampaign, NewRule } from "../../src/server/db/schema";

config({ path: [".env.local", ".env"], quiet: true });

const DAY_MS = 24 * 60 * 60 * 1000;

function assertDemoDatabase() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  if (!/demo/i.test(name) && !process.argv.includes("--force")) {
    throw new Error(
      `Refusing to seed database "${name}": its name must contain "demo" (this script wipes app tables). Use --force to override.`,
    );
  }
  return name;
}

/** Small seeded PRNG (mulberry32) so every run produces the same mix. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(20261015);
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
const between = (min: number, max: number) => Math.round(min + random() * (max - min));
const digits = (n: number) => Array.from({ length: n }, () => between(0, 9)).join("");

/** Gradient thumbnail as an inline SVG data URI (no external image hosts). */
function thumbnail(label: string, from: string, to: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/>` +
    `<stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="96" height="96" fill="url(#g)"/>` +
    `<text x="48" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" ` +
    `font-weight="700" fill="#fff">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const COMMENTERS = [
  "alex.design",
  "sari_creates",
  "budi.codes",
  "mia.studio",
  "rina_reads",
  "dimas.dev",
  "lena.makes",
  "tom_builds",
  "putri.writes",
  "jordan.edits",
  "ayu_plans",
  "kevin.learns",
  "nadia.notes",
  "omar.sketches",
  "fajar.films",
  "chloe.cooks",
  "yuki.draws",
  "rizky.ships",
  "maya.blooms",
  "sam.tinkers",
  "dewi.designs",
  "lucas.loops",
  "tari_travels",
  "ben.bakes",
  "intan.ideas",
  "noah.notion",
  "citra.crafts",
  "eko.explores",
  "ivy.illustrates",
  "gita.grows",
  "hana.hustles",
  "raka.records",
  "zoe.zines",
  "wulan.writes",
  "leo.learns",
  "vina.vlogs",
  "arif.arts",
  "ella.edits",
  "bayu.builds",
  "kira.knits",
] as const;

const OFF_TOPIC = [
  "Love this! 😍",
  "🔥🔥🔥",
  "Where did you get that desk lamp?",
  "So useful, thanks for sharing",
  "Saving this for later",
  "Can you do one about Canva next?",
  "This is gold 🙌",
  "first!",
  "Great tips as always",
  "Which app do you use for this?",
] as const;

type Plan = {
  campaign: NewCampaign;
  rules: (Omit<NewRule, "campaignId"> & { comments: string[] })[];
  weight: number;
};

const PLANS: Plan[] = [
  {
    weight: 0.42,
    campaign: {
      name: "Free Notion & Drive templates",
      description: "Pinned reel: comment DRIVE to get the template folder.",
      mediaId: "18000000000000101",
      mediaCaption: "Comment DRIVE and I'll DM you the whole template folder 📁 (free!)",
      mediaThumbnailUrl: thumbnail("DRIVE", "#f58529", "#dd2a7b"),
    },
    rules: [
      {
        name: "Template folder",
        keywords: ["drive", "template", "folder"],
        matchMode: "word",
        publicReplies: [
          "Sent! Check your DMs, {username} 📩",
          "Done, {username}! The folder is in your inbox ✨",
          "Just DMed you the link 🙌",
        ],
        dmMessage:
          "Hi {username}! Here's the free template folder you asked for. Duplicate it to your own Drive and make it yours. Enjoy!",
        dmButtonTitle: "Open the folder",
        dmButtonUrl: "https://example.com/templates",
        oncePerUser: true,
        priority: 0,
        comments: [
          "DRIVE",
          "drive please!",
          "Drive 🙏",
          "DRIVE pls",
          "template!",
          "drive",
          "Drive please 🙌",
        ],
      },
    ],
  },
  {
    weight: 0.33,
    campaign: {
      name: "AI prompt pack",
      description: "Carousel with 30 prompts for content planning.",
      mediaId: "18000000000000102",
      mediaCaption: "30 prompts that plan a month of content in 10 minutes. Comment PROMPT for the full pack",
      mediaThumbnailUrl: thumbnail("PROMPT", "#8134af", "#515bd4"),
    },
    rules: [
      {
        name: "Prompt pack",
        keywords: ["prompt", "prompts"],
        matchMode: "word",
        publicReplies: [
          "Check your DMs, {username} 🤖",
          "On its way to your inbox!",
          "Sent 📬 enjoy the prompts",
        ],
        dmMessage:
          "Hey {username}, here's the prompt pack 🎁 Copy any prompt, swap in your niche, and you're set. Reply here if you get stuck!",
        dmButtonTitle: "Get the prompts",
        dmButtonUrl: "https://example.com/prompts",
        oncePerUser: true,
        priority: 0,
        comments: ["PROMPT", "prompt please", "Prompts!", "PROMPT 🙏", "prompt", "need the prompts"],
      },
    ],
  },
  {
    weight: 0.25,
    campaign: {
      name: "Ebook launch (all posts)",
      description: "Any post: EBOOK or GUIDE sends the free ebook.",
      mediaId: null,
    },
    rules: [
      {
        name: "Free ebook",
        keywords: ["ebook", "e-book"],
        matchMode: "contains",
        publicReplies: ["Sent you the ebook, {username} 📘", "Check your inbox!"],
        dmMessage:
          "Thanks for the comment, {username}! Here's your free copy of the Creator Systems ebook. Chapter 3 is the one everyone loves.",
        dmButtonTitle: "Download the ebook",
        dmButtonUrl: "https://example.com/ebook",
        oncePerUser: true,
        priority: 1,
        comments: ["EBOOK", "ebook please", "Ebook!", "can I get the ebook?", "EBOOK 📘"],
      },
      {
        name: "Starter guide",
        keywords: ["guide"],
        matchMode: "exact",
        publicReplies: [],
        dmMessage: "Here's the starter guide, {username}. It takes about 15 minutes to read. Have fun!",
        dmButtonTitle: "Read the guide",
        dmButtonUrl: "https://example.com/guide",
        oncePerUser: true,
        priority: 0,
        comments: ["GUIDE", "guide", "Guide"],
      },
    ],
  },
];

type Outcome =
  | { status: "sent" }
  | { status: "partial"; code: string; error: string }
  | { status: "failed"; code: string; error: string }
  | { status: "skipped"; reason: "no_match" | "already_delivered" };

function outcome(): Outcome {
  const r = random();
  if (r < 0.66) return { status: "sent" };
  if (r < 0.73)
    return pick([
      {
        status: "partial",
        code: "551",
        error: "private reply: (#551) This person isn't available right now.",
      },
      {
        status: "partial",
        code: "2534022",
        error: "private reply: (#100) This message is sent outside of allowed window.",
      },
    ] as const);
  if (r < 0.78)
    return pick([
      {
        status: "failed",
        code: "4",
        error:
          "public reply: (#4) Application request limit reached; private reply: (#4) Application request limit reached",
      },
      {
        status: "failed",
        code: "100",
        error: "public reply: (#100) Object does not exist or cannot be loaded (comment deleted?)",
      },
    ] as const);
  if (r < 0.95) return { status: "skipped", reason: "no_match" };
  return { status: "skipped", reason: "already_delivered" };
}

async function main() {
  const dbName = assertDemoDatabase();
  // App modules are imported after the guard (they read env lazily). Run with
  // `tsx --conditions=react-server` so their `import "server-only"` markers resolve.
  const { db } = await import("../../src/server/db/client");
  const schema = await import("../../src/server/db/schema");
  const { encrypt, randomToken } = await import("../../src/server/crypto");
  const { hashPassword } = await import("../../src/server/auth/password");
  const { setSetting } = await import("../../src/server/settings");

  console.log(`[demo] seeding ${dbName}`);
  await db.execute(
    sql`truncate table deliveries, rules, campaigns, instagram_accounts, settings, api_keys, users, login_attempts, data_deletion_requests restart identity cascade`,
  );

  const now = new Date();
  await db.insert(schema.users).values({
    username: "admin",
    passwordHash: await hashPassword(process.env.DEMO_PASSWORD ?? "demo-password-2026"),
    mustChangePassword: false,
    lastLoginAt: now,
  });

  await setSetting("meta.appId", "1234567890123456");
  await setSetting("meta.appSecret", "demo-app-secret-not-a-real-value");
  await setSetting("webhook.verifyToken", randomToken());
  await setSetting("processing.mode", "webhook");
  await setSetting("processing.enabled", true);
  await setSetting("general.timezone", "Asia/Jakarta");
  await setSetting("general.operatorName", "Your Brand Studio");
  await setSetting("general.contactEmail", "privacy@example.com");

  const igUserId = "17841400000000001";
  const [account] = await db
    .insert(schema.instagramAccounts)
    .values({
      igUserId,
      username: "yourbrand",
      name: "Your Brand Studio",
      accessTokenEnc: encrypt("demo-token-not-real"),
      tokenExpiresAt: new Date(now.getTime() + 47 * DAY_MS),
      tokenRefreshedAt: new Date(now.getTime() - 13 * DAY_MS),
      isActive: true,
    })
    .returning();
  if (!account) throw new Error("account insert failed");

  type Target = {
    campaignId: string;
    mediaId: string | null;
    ruleId: string;
    keyword: string;
    comments: string[];
  };
  const targets: { weight: number; options: Target[] }[] = [];
  for (const [i, plan] of PLANS.entries()) {
    const [campaign] = await db
      .insert(schema.campaigns)
      .values({
        ...plan.campaign,
        accountId: account.id,
        createdAt: new Date(now.getTime() - (20 - i * 3) * DAY_MS),
      })
      .returning();
    if (!campaign) throw new Error("campaign insert failed");
    const options: Target[] = [];
    for (const { comments, ...rule } of plan.rules) {
      const [row] = await db
        .insert(schema.rules)
        .values({ ...rule, campaignId: campaign.id })
        .returning();
      if (!row) throw new Error("rule insert failed");
      options.push({
        campaignId: campaign.id,
        mediaId: campaign.mediaId ?? `1800000000000020${options.length}`,
        ruleId: row.id,
        keyword: rule.keywords?.[0] ?? "",
        comments,
      });
    }
    targets.push({ weight: plan.weight, options });
  }

  const rows: (typeof schema.deliveries.$inferInsert)[] = [];
  const DAYS = 14;
  for (let day = DAYS - 1; day >= 0; day--) {
    // Gentle upward trend with weekday noise: ~6 comments two weeks ago, ~15 today.
    const count = Math.max(2, Math.round(5 + (DAYS - day) * 0.75 + (random() - 0.5) * 5));
    for (let n = 0; n < count; n++) {
      const msAgo = day * DAY_MS + between(0, DAY_MS - 1);
      const createdAt = new Date(now.getTime() - Math.max(msAgo, between(60_000, 3_600_000)));
      const roll = random();
      let acc = 0;
      const group = targets.find((t) => (acc += t.weight) >= roll) ?? targets[0]!;
      const target = pick(group.options);
      const result = outcome();
      const username = pick(COMMENTERS);
      const durationMs = between(380, 1900);
      const base = {
        commentId: `179${digits(14)}`,
        mediaId: target.mediaId,
        igUserId,
        commenterId: `178414${digits(11)}`,
        commenterUsername: username,
        createdAt,
        processedAt: new Date(createdAt.getTime() + durationMs),
        durationMs,
        source: "webhook" as const,
      };
      if (result.status === "skipped" && result.reason === "no_match") {
        rows.push({
          ...base,
          commentText: pick(OFF_TOPIC),
          status: "skipped",
          skipReason: "no_match",
          attempts: 0,
        });
        continue;
      }
      const matched = {
        ...base,
        campaignId: target.campaignId,
        ruleId: target.ruleId,
        matchedKeyword: target.keyword,
        commentText: pick(target.comments),
      };
      if (result.status === "skipped") {
        rows.push({ ...matched, status: "skipped", skipReason: result.reason, attempts: 0 });
        continue;
      }
      const hasPublic = target.keyword !== "guide";
      if (!hasPublic && result.status !== "sent") {
        // DM-only rule: a failure can only come from the private reply.
        rows.push({
          ...matched,
          status: "failed",
          dmStatus: "failed",
          errorCode: "551",
          error: "private reply: (#551) This person isn't available right now.",
          attempts: 1,
        });
        continue;
      }
      const publicOk = result.status === "sent" || result.status === "partial";
      const dmOk = result.status === "sent";
      rows.push({
        ...matched,
        status: result.status,
        publicReplyStatus: hasPublic ? (publicOk ? "sent" : "failed") : "not_attempted",
        publicReplyId: hasPublic && publicOk ? `180${digits(14)}` : null,
        dmStatus: dmOk ? "sent" : "failed",
        dmMessageId: dmOk ? `aWdfZGVtb18${digits(12)}` : null,
        errorCode: result.status === "sent" ? null : result.code,
        error: result.status === "sent" ? null : result.error,
        attempts: 1,
      });
    }
  }
  await db.insert(schema.deliveries).values(rows);

  const tally = rows.reduce<Record<string, number>>(
    (t, r) => ({ ...t, [r.status ?? "?"]: (t[r.status ?? "?"] ?? 0) + 1 }),
    {},
  );
  console.log(`[demo] 1 user, 1 account, ${PLANS.length} campaigns, ${rows.length} deliveries`, tally);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("[demo] failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
