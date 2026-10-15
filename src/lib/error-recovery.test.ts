import { describe, expect, it } from "vitest";
import {
  canAttempt,
  decideRecovery,
  isVersionSkewError,
  parseTimestamp,
  RELOAD_GUARD_MS,
  RETRY_GUARD_MS,
  STORAGE_KEYS,
} from "./error-recovery";

function named(name: string, message = "x") {
  const e = new Error(message);
  e.name = name;
  return e;
}

describe("isVersionSkewError", () => {
  it.each([
    named("ChunkLoadError", "Loading chunk 123 failed."),
    named("UnrecognizedActionError", "whatever"),
    new Error("Loading chunk app/(dashboard)/layout failed."),
    new Error("Loading CSS chunk 42 failed"),
    new Error("Failed to load chunk /_next/static/chunks/abc.js from module 1234"),
    new TypeError("Failed to fetch dynamically imported module: https://x/_next/static/chunks/a.js"),
    new TypeError("error loading dynamically imported module"),
    new TypeError("Importing a module script failed."),
    new Error('Server Action "7f3a" was not found on the server. \nRead more: https://nextjs.org/docs'),
    new Error("Failed to find Server Action. This request might be from an older or newer deployment."),
    new Error("Deployment ID mismatch"),
    "ChunkLoadError: Loading chunk 9 failed",
  ])("detects %s", (err) => {
    expect(isVersionSkewError(err)).toBe(true);
  });

  it("looks one level into cause", () => {
    expect(isVersionSkewError(new Error("render failed", { cause: named("ChunkLoadError") }))).toBe(true);
  });

  it.each([
    new Error("An error occurred in the Server Components render."),
    new Error("Connection terminated unexpectedly"),
    new TypeError("Failed to fetch"),
    new TypeError("Cannot read properties of undefined (reading 'map')"),
    named("ZodError", "invalid"),
    null,
    undefined,
    42,
    {},
  ])("ignores %s", (err) => {
    expect(isVersionSkewError(err)).toBe(false);
  });
});

describe("parseTimestamp", () => {
  it("parses positive numbers and rejects junk", () => {
    expect(parseTimestamp("1700000000000")).toBe(1700000000000);
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp("abc")).toBeNull();
    expect(parseTimestamp("-5")).toBeNull();
    expect(parseTimestamp("Infinity")).toBeNull();
  });
});

describe("canAttempt", () => {
  it("allows the first attempt and again after the window", () => {
    expect(canAttempt(null, 1000, 500)).toBe(true);
    expect(canAttempt(1000, 1499, 500)).toBe(false);
    expect(canAttempt(1000, 1500, 500)).toBe(true);
  });

  it("treats a clock that went backwards as recent", () => {
    expect(canAttempt(2000, 1000, 500)).toBe(false);
  });
});

describe("decideRecovery", () => {
  const now = 10_000_000;
  const skew = named("ChunkLoadError");
  const other = new Error("An error occurred in the Server Components render.");

  it("reloads once on version skew", () => {
    expect(decideRecovery({ error: skew, now, lastReloadAt: null, lastRetryAt: null })).toBe("reload");
  });

  it("falls back to retry, then to the card, after a recent reload", () => {
    const lastReloadAt = now - 1000;
    expect(decideRecovery({ error: skew, now, lastReloadAt, lastRetryAt: null })).toBe("retry");
    expect(decideRecovery({ error: skew, now, lastReloadAt, lastRetryAt: now - 1000 })).toBe("show");
  });

  it("reloads again once the reload guard expired", () => {
    expect(
      decideRecovery({ error: skew, now, lastReloadAt: now - RELOAD_GUARD_MS, lastRetryAt: now - 1 }),
    ).toBe("reload");
  });

  it("retries other errors once per window", () => {
    expect(decideRecovery({ error: other, now, lastReloadAt: null, lastRetryAt: null })).toBe("retry");
    expect(decideRecovery({ error: other, now, lastReloadAt: null, lastRetryAt: now - 1 })).toBe("show");
    expect(decideRecovery({ error: other, now, lastReloadAt: null, lastRetryAt: now - RETRY_GUARD_MS })).toBe(
      "retry",
    );
  });

  it("never reloads for non-skew errors", () => {
    expect(decideRecovery({ error: other, now, lastReloadAt: null, lastRetryAt: now })).toBe("show");
  });
});

describe("STORAGE_KEYS", () => {
  it("scopes retries per path", () => {
    expect(STORAGE_KEYS.retryAt("/dashboard")).not.toBe(STORAGE_KEYS.retryAt("/settings"));
  });
});
