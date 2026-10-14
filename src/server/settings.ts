import "server-only";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/timezone";
import { decrypt, encrypt, randomToken } from "./crypto";
import { db } from "./db/client";
import { settings } from "./db/schema";

/**
 * Typed registry of in-app settings. Add new settings here; `secret: true` values are
 * encrypted at rest and never sent to the browser (use `getPublicSettings` for UI).
 */
export const SETTINGS = {
  /** Instagram app (Meta developer dashboard -> Instagram -> API setup with Instagram login). */
  "meta.appId": { schema: z.string().regex(/^\d{5,25}$/, "Must be a numeric app id"), secret: false },
  "meta.appSecret": { schema: z.string().min(16).max(128), secret: true },
  /** Token Meta echoes back when verifying the webhook subscription. Auto-generated. */
  "webhook.verifyToken": { schema: z.string().min(16).max(128), secret: true },
  /** `webhook` = this app receives Meta webhooks directly. `n8n` = n8n relays them. */
  "processing.mode": { schema: z.enum(["webhook", "n8n"]), secret: false },
  /** Kill switch: when false, comments are logged but nothing is sent. */
  "processing.enabled": { schema: z.boolean(), secret: false },
  /** IANA time zone used for calendar days in analytics and "today" on the dashboard. */
  "general.timezone": {
    schema: z.string().refine(isValidTimeZone, "Unknown time zone"),
    secret: false,
  },
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]["schema"]>;

const DEFAULTS: { [K in SettingKey]?: () => SettingValue<K> } = {
  "processing.mode": () => "webhook",
  "processing.enabled": () => true,
  "general.timezone": () => DEFAULT_TIME_ZONE,
};

type Stored = { v: unknown } | { enc: string };

function decode<K extends SettingKey>(key: K, raw: unknown): SettingValue<K> | undefined {
  const stored = raw as Stored;
  const value = "enc" in stored ? JSON.parse(decrypt(stored.enc)) : stored.v;
  const parsed = SETTINGS[key].schema.safeParse(value);
  return parsed.success ? (parsed.data as SettingValue<K>) : undefined;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K> | undefined> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (row) return decode(key, row.value);
  return DEFAULTS[key]?.() as SettingValue<K> | undefined;
}

export async function getSettings<K extends SettingKey>(keys: K[]): Promise<{ [P in K]?: SettingValue<P> }> {
  const rows = await db.select().from(settings).where(inArray(settings.key, keys));
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const row = rows.find((r) => r.key === key);
    out[key] = row ? decode(key, row.value) : DEFAULTS[key]?.();
  }
  return out as { [P in K]?: SettingValue<P> };
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> {
  const def = SETTINGS[key];
  const parsed = def.schema.parse(value);
  const stored: Stored = def.secret ? { enc: encrypt(JSON.stringify(parsed)) } : { v: parsed };
  await db
    .insert(settings)
    .values({ key, value: stored })
    .onConflictDoUpdate({ target: settings.key, set: { value: stored, updatedAt: new Date() } });
}

export async function deleteSetting(key: SettingKey): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
}

/** Webhook verify token, created on first use. */
export async function ensureVerifyToken(): Promise<string> {
  const existing = await getSetting("webhook.verifyToken");
  if (existing) return existing;
  const token = randomToken(24);
  await setSetting("webhook.verifyToken", token);
  return token;
}

/** Browser-safe view: secrets are reported only as configured / not configured. */
export async function getPublicSettings() {
  const keys = Object.keys(SETTINGS) as SettingKey[];
  const values = await getSettings(keys);
  return Object.fromEntries(
    keys.map((k) => [k, SETTINGS[k].secret ? { configured: values[k] !== undefined } : { value: values[k] }]),
  ) as {
    [K in SettingKey]: (typeof SETTINGS)[K]["secret"] extends true
      ? { configured: boolean }
      : { value: SettingValue<K> | undefined };
  };
}

/** Configured analytics/dashboard time zone (falls back to UTC). */
export async function getTimeZone(): Promise<string> {
  return (await getSetting("general.timezone")) ?? DEFAULT_TIME_ZONE;
}
