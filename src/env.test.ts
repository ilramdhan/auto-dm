import { describe, expect, it } from "vitest";
import { envProblems } from "./env";

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
