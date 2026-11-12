import { afterEach, describe, expect, it, vi } from "vitest";
import type { InstagramAccount } from "@/server/db/schema";
const request = vi.hoisted(() => vi.fn());
vi.mock("./graph", async () => ({ ...(await vi.importActual("./graph")), graphRequest: request }));
vi.mock("@/server/db/client", () => ({ db: {}, retryable: (_name: string, fn: unknown) => fn }));
import { refreshTokenIfNeeded } from "./account";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("Unified system-user token lifecycle", () => {
  it("never calls the Instagram refresh endpoint, including a forced refresh", async () => {
    vi.stubEnv("META_CONFIG_ID", "123456789012345");
    const account = { tokenExpiresAt: null } as InstagramAccount;
    expect(await refreshTokenIfNeeded(account, { force: true })).toEqual({
      refreshed: false,
      expiresAt: null,
    });
    expect(request).not.toHaveBeenCalled();
  });
  it("requests reconnection when a finite token has expired", async () => {
    vi.stubEnv("META_CONFIG_ID", "123456789012345");
    const account = { tokenExpiresAt: new Date(0) } as InstagramAccount;
    await expect(refreshTokenIfNeeded(account)).rejects.toThrow("Reconnect Instagram");
    expect(request).not.toHaveBeenCalled();
  });
});
