import "server-only";
import { z } from "zod";

/**
 * Server environment. Kept intentionally tiny: everything else (Meta app credentials,
 * Instagram tokens, n8n API keys) is configured in-app on the Settings page and stored
 * encrypted in the database.
 *
 * DATABASE_URL falls back to the variables injected by the Vercel <-> Supabase integration.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  /** >= 32 chars. Used to derive the session-signing key and the secrets-encryption key. */
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  /** Public base URL, e.g. https://autodm.example.com. Falls back to Vercel's production URL. */
  APP_URL: z.string().url().optional(),
  /** First-run credentials. The account is forced to change the password on first login. */
  ADMIN_DEFAULT_USERNAME: z.string().min(3).default("admin"),
  ADMIN_DEFAULT_PASSWORD: z.string().min(8).default("changeme123"),
  /** Vercel sends `Authorization: Bearer $CRON_SECRET` to cron routes when set. */
  CRON_SECRET: z.string().min(16).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const raw = process.env;
  const vercelUrl = raw.VERCEL_PROJECT_PRODUCTION_URL ?? raw.VERCEL_URL;
  const parsed = schema.safeParse({
    ...raw,
    DATABASE_URL: raw.DATABASE_URL ?? raw.POSTGRES_URL,
    APP_URL: raw.APP_URL ?? (vercelUrl ? `https://${vercelUrl}` : undefined),
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export function appUrl(): string {
  return (env().APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
