import { afterEach, describe, expect, it, vi } from "vitest";
import { getRequestId, logger, MAX_STRING, parseLogLevel, redact, serializeError } from "./log";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("redact", () => {
  it("passes normal fields through", () => {
    const input = { commentId: "c1", status: "sent", durationMs: 12, ok: true, none: null, list: [1, "a"] };
    expect(redact(input)).toEqual(input);
  });

  it("redacts sensitive keys case-insensitively, deeply and inside arrays", () => {
    const out = redact({
      access_token: "a",
      Authorization: "Bearer x",
      nested: { ClientSecret: "s", password: "p", keep: "ok", deeper: [{ apiKey: "k", cookie: "c", id: 1 }] },
      signed_request: "sr",
      app_secret: "as",
      verify_token: "vt",
      "api-key": "k2",
    });
    expect(out).toEqual({
      access_token: "[redacted]",
      Authorization: "[redacted]",
      nested: {
        ClientSecret: "[redacted]",
        password: "[redacted]",
        keep: "ok",
        deeper: [{ apiKey: "[redacted]", cookie: "[redacted]", id: 1 }],
      },
      signed_request: "[redacted]",
      app_secret: "[redacted]",
      verify_token: "[redacted]",
      "api-key": "[redacted]",
    });
  });

  it("handles circular references", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    a.child = { parent: a };
    const out = redact(a) as Record<string, unknown>;
    expect(out.self).toBe("[circular]");
    expect((out.child as Record<string, unknown>).parent).toBe("[circular]");
    expect(() => JSON.stringify(out)).not.toThrow();
  });

  it("does not flag shared (non-circular) references", () => {
    const shared = { x: 1 };
    expect(redact({ a: shared, b: shared })).toEqual({ a: { x: 1 }, b: { x: 1 } });
  });

  it("caps string length, array size and depth", () => {
    const out = redact({
      long: "x".repeat(MAX_STRING + 100),
      arr: Array.from({ length: 80 }, (_, i) => i),
    }) as {
      long: string;
      arr: number[];
    };
    expect(out.long.startsWith("x".repeat(MAX_STRING))).toBe(true);
    expect(out.long).toContain("truncated 100");
    expect(out.arr).toHaveLength(50);
    const deep = { l1: { l2: { l3: { l4: { l5: { l6: "end" } } } } } };
    expect(JSON.stringify(redact(deep))).toContain("[max-depth]");
  });

  it("serialises bigint and drops functions", () => {
    expect(redact({ n: BigInt(10), f: () => 1 })).toEqual({ n: "10", f: undefined });
  });
});

describe("serializeError", () => {
  it("keeps name, message and safe props; cause only by name", () => {
    const cause = Object.assign(new TypeError("boom with params"), { parameters: ["secret-value"] });
    const err = Object.assign(new Error("failed", { cause }), {
      code: "23505",
      query: "select 1",
      params: ["p"],
    });
    const out = serializeError(err);
    expect(out).toMatchObject({ name: "Error", message: "failed", code: "23505", cause: "TypeError" });
    const json = JSON.stringify(out);
    expect(json).not.toContain("secret-value");
    expect(json).not.toContain("select 1");
    expect(json).not.toContain("boom with params");
  });

  it("strips bound SQL params from the message", () => {
    const out = serializeError(new Error("Failed query: select * from t where a = $1\nparams: hunter2"));
    expect(JSON.stringify(out)).not.toContain("hunter2");
    expect(out.message).toBe("Failed query: select * from t where a = $1");
  });

  it("includes a truncated stack only outside production (or at debug)", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(serializeError(new Error("x"))).toHaveProperty("stack");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "info");
    expect(serializeError(new Error("x"))).not.toHaveProperty("stack");
    vi.stubEnv("LOG_LEVEL", "debug");
    expect(serializeError(new Error("x"))).toHaveProperty("stack");
  });

  it("redacts Errors nested in fields and caps long messages", () => {
    const out = redact({ err: new Error("m".repeat(MAX_STRING + 50)) }) as { err: { message: string } };
    expect(out.err.message).toContain("truncated 50");
  });

  it("handles non-Error values", () => {
    expect(serializeError("oops")).toEqual({ message: "oops" });
  });
});

describe("parseLogLevel", () => {
  it("accepts valid levels case-insensitively", () => {
    expect(parseLogLevel("WARN", "production")).toBe("warn");
    expect(parseLogLevel("debug", "production")).toBe("debug");
    expect(parseLogLevel("error", undefined)).toBe("error");
  });
  it("defaults to debug in development and info otherwise", () => {
    expect(parseLogLevel(undefined, "development")).toBe("debug");
    expect(parseLogLevel(undefined, "production")).toBe("info");
    expect(parseLogLevel("", "production")).toBe("info");
  });
  it("falls back to info when invalid", () => {
    expect(parseLogLevel("verbose", "development")).toBe("info");
  });
});

describe("logger", () => {
  function capture() {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((l: string) => void lines.push(l));
    vi.spyOn(console, "warn").mockImplementation((l: string) => void lines.push(l));
    vi.spyOn(console, "error").mockImplementation((l: string) => void lines.push(l));
    return lines;
  }

  it("emits one JSON line with level, time, scope, msg, legacy aliases and redacted fields", () => {
    vi.stubEnv("LOG_LEVEL", "info");
    const lines = capture();
    logger("t").info("thing.happened", { commentId: "c1", access_token: "tok", level: "spoof" });
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("\n");
    const e = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(e).toMatchObject({
      level: "info",
      scope: "t",
      msg: "thing.happened",
      event: "thing.happened",
      commentId: "c1",
      access_token: "[redacted]",
    });
    expect(new Date(e.time as string).toISOString()).toBe(e.time);
    expect(e.ts).toBe(e.time);
  });

  it("filters below LOG_LEVEL and treats invalid values as info", () => {
    vi.stubEnv("LOG_LEVEL", "warn");
    const lines = capture();
    const log = logger("t");
    log.info("a");
    log.warn("b");
    log.error("c");
    expect(lines.map((l) => (JSON.parse(l) as { msg: string }).msg)).toEqual(["b", "c"]);
    vi.stubEnv("LOG_LEVEL", "nonsense");
    lines.length = 0;
    log.debug("d");
    log.info("i");
    expect(lines).toHaveLength(1);
  });

  it("child() adds context to every line without mutating the parent", () => {
    vi.stubEnv("LOG_LEVEL", "info");
    const lines = capture();
    const log = logger("t");
    const child = log.child({ requestId: "r1" }).child({ extra: 1 });
    child.info("x", { a: 1 });
    log.info("y");
    const [first, second] = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(first).toMatchObject({ requestId: "r1", extra: 1, a: 1 });
    expect(second).not.toHaveProperty("requestId");
  });
});

describe("getRequestId", () => {
  it("prefers x-vercel-id, then x-request-id, then a UUID", () => {
    expect(getRequestId(new Headers({ "x-vercel-id": "fra1::abc", "x-request-id": "r" }))).toBe("fra1::abc");
    expect(getRequestId(new Headers({ "x-request-id": "r" }))).toBe("r");
    expect(getRequestId(new Headers())).toMatch(/^[0-9a-f-]{36}$/);
  });
});
