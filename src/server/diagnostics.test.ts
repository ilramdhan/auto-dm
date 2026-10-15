import { afterEach, describe, expect, it, vi } from "vitest";
import { watchSections, type SlowPageInfo } from "./diagnostics";

const after = <T>(ms: number, value: T) => new Promise<T>((r) => setTimeout(() => r(value), ms));
const failAfter = (ms: number) =>
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error("x")), ms));

function lastInfo(fn: ReturnType<typeof vi.fn>): SlowPageInfo {
  return fn.mock.calls.at(-1)![0] as SlowPageInfo;
}

describe("watchSections", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reports per-section timings and the region when the slowest section crosses the threshold", async () => {
    vi.stubEnv("VERCEL_REGION", "iad1");
    const onSlow = vi.fn();
    await watchSections({ fast: after(0, 1), slow: after(30, 2) }, onSlow, { thresholdMs: 20 });
    expect(onSlow).toHaveBeenCalledOnce();
    const info = lastInfo(onSlow);
    expect(info.region).toBe("iad1");
    expect(info.sections.fast?.ok).toBe(true);
    expect(info.sections.slow?.ms).toBeGreaterThanOrEqual(20);
    expect(info.durationMs).toBe(info.sections.slow?.ms);
  });

  it("stays quiet under the threshold", async () => {
    const onSlow = vi.fn();
    await watchSections({ a: after(0, 1) }, onSlow, { thresholdMs: 1000 });
    expect(onSlow).not.toHaveBeenCalled();
  });

  it("counts from startedAt, marks failed sections and never rejects", async () => {
    const onSlow = vi.fn();
    const startedAt = performance.now() - 50;
    await expect(
      watchSections({ broken: failAfter(0) }, onSlow, { startedAt, thresholdMs: 40 }),
    ).resolves.toBeUndefined();
    expect(lastInfo(onSlow).sections.broken).toMatchObject({ ok: false });
  });

  it("swallows errors thrown by the callback", async () => {
    const boom = () => {
      throw new Error("boom");
    };
    await expect(watchSections({ a: after(0, 1) }, boom, { thresholdMs: 0 })).resolves.toBeUndefined();
  });
});
