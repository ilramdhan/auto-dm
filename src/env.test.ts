import { describe, expect, it } from "vitest";
import { envProblems, publicBaseUrl } from "./env";

const SECRET = "x".repeat(32);

describe("envProblems", () => {
  it("lists missing required variables by name only", () => {
    expect(envProblems({})).toEqual(["DATABASE_URL", "APP_SECRET"]);
  });

  it("accepts the Vercel/Supabase POSTGRES_URL fallback", () => {
    expect(
      envProblems({
        POSTGRES_URL: "postgres://u:p@db.example.com:6543/postgres",
        APP_SECRET: SECRET,
      }),
    ).toEqual([]);
  });

  it("flags a short APP_SECRET without echoing its value", () => {
    const problems = envProblems({
      DATABASE_URL: "postgres://u:p@localhost/db",
      APP_SECRET: "short",
    });
    expect(problems).toEqual(["APP_SECRET"]);
  });
});

describe("publicBaseUrl", () => {
  it("uses APP_URL without a trailing slash", () => {
    expect(publicBaseUrl({ APP_URL: "https://autodm.example.com/" })).toBe("https://autodm.example.com");
  });

  it("falls back to the Vercel production URL", () => {
    expect(publicBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: "my-app.vercel.app" })).toBe(
      "https://my-app.vercel.app",
    );
  });

  it("returns null instead of throwing when unset or invalid", () => {
    expect(publicBaseUrl({})).toBeNull();
    expect(publicBaseUrl({ APP_URL: "not a url" })).toBeNull();
    expect(publicBaseUrl({ APP_URL: "javascript:alert(1)" })).toBeNull();
  });
});
