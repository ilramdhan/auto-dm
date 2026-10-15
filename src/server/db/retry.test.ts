import { afterEach, describe, expect, it, vi } from "vitest";
import { isTransientDbError, retryable, withDbRetry } from "./retry";

function withCode(code: string, message = `write ${code} pooler.example:6543`) {
  return Object.assign(new Error(message), { code });
}

afterEach(() => vi.restoreAllMocks());

describe("isTransientDbError", () => {
  it.each([
    "CONNECTION_CLOSED",
    "CONNECTION_ENDED",
    "CONNECTION_DESTROYED",
    "CONNECT_TIMEOUT",
    "ECONNRESET",
    "ETIMEDOUT",
    "EPIPE",
    "08006",
    "57P01",
  ])("detects code %s", (code) => {
    expect(isTransientDbError(withCode(code))).toBe(true);
  });

  it.each([
    "Connection terminated unexpectedly",
    "Connection ended",
    "read ECONNRESET",
    "socket hang up",
    "server closed the connection unexpectedly",
  ])("detects message %j", (message) => {
    expect(isTransientDbError(new Error(message))).toBe(true);
  });

  it("looks through Drizzle's wrapper (cause chain)", () => {
    const wrapped = new Error('Failed query: select "id" from "users"\nparams: x', {
      cause: withCode("CONNECTION_CLOSED"),
    });
    expect(isTransientDbError(wrapped)).toBe(true);
    const deeper = new Error("outer", {
      cause: new Error("middle", { cause: new Error("read ECONNRESET") }),
    });
    expect(isTransientDbError(deeper)).toBe(true);
  });

  it("ignores query errors", () => {
    expect(isTransientDbError(withCode("23505", "duplicate key value violates unique constraint"))).toBe(
      false,
    );
    expect(isTransientDbError(withCode("42P01", 'relation "x" does not exist'))).toBe(false);
    expect(isTransientDbError(withCode("28P01", "password authentication failed"))).toBe(false);
    expect(
      isTransientDbError(new Error("Failed query: select 1", { cause: withCode("42601", "syntax") })),
    ).toBe(false);
  });

  it("only reads the first line of a message (Drizzle appends SQL and params)", () => {
    expect(isTransientDbError(new Error("Failed query: select 1\nparams: connection terminated"))).toBe(
      false,
    );
  });

  it("handles non-errors", () => {
    expect(isTransientDbError(undefined)).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError("ECONNRESET")).toBe(false);
    expect(isTransientDbError({ code: "ECONNRESET" })).toBe(true);
  });

  it("stops on circular causes", () => {
    const a = new Error("a") as Error & { cause?: unknown };
    a.cause = a;
    expect(isTransientDbError(a)).toBe(false);
  });
});

describe("withDbRetry", () => {
  it("returns the first result without retrying", async () => {
    const fn = vi.fn().mockResolvedValue(1);
    await expect(withDbRetry(fn, { label: "t", delayMs: 0 })).resolves.toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries once on a connection error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fn = vi.fn().mockRejectedValueOnce(withCode("CONNECTION_CLOSED")).mockResolvedValueOnce("ok");
    await expect(withDbRetry(fn, { label: "t", delayMs: 0 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = withCode("ECONNRESET");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withDbRetry(fn, { label: "t", delayMs: 0 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry query errors", async () => {
    const err = withCode("23505", "duplicate key");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withDbRetry(fn, { label: "t", delayMs: 0 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("logs the retry without the error message", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("Failed query: select secret\nparams: x", { cause: withCode("ECONNRESET") }),
      )
      .mockResolvedValueOnce(1);
    await withDbRetry(fn, { label: "auth.currentUser", delayMs: 0 });
    const line = JSON.parse(String(warn.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(line).toMatchObject({
      msg: "db.retry",
      label: "auth.currentUser",
      attempt: 1,
      code: "ECONNRESET",
    });
    expect(JSON.stringify(line)).not.toContain("secret");
  });
});

describe("retryable", () => {
  it("passes arguments through and retries the whole function", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const inner = vi
      .fn<(a: number, b?: string) => Promise<string>>()
      .mockRejectedValueOnce(withCode("CONNECTION_ENDED"))
      .mockImplementation(async (a, b) => `${a}${b ?? ""}`);
    const wrapped = retryable("t", inner);
    await expect(wrapped(1, "x")).resolves.toBe("1x");
    expect(inner).toHaveBeenCalledTimes(2);
    expect(inner).toHaveBeenLastCalledWith(1, "x");
  });
});
