import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  setSetting: vi.fn(),
  upsertAccount: vi.fn(),
  getActiveAccount: vi.fn(),
}));
vi.mock("@/server/settings", () => ({ getSettings: mocks.getSettings, setSetting: mocks.setSetting }));
vi.mock("./account", async () => {
  const { z } = await import("zod");
  return {
    getActiveAccount: mocks.getActiveAccount,
    upsertAccount: mocks.upsertAccount,
    tokenResponseSchema: z.object({ access_token: z.string().min(1), expires_in: z.number().optional() }),
  };
});
import { buildAuthorizeUrl, completeOAuth, createOAuthState, verifyOAuthState } from "./oauth";

const configId = "123456789012345";
const appId = "987654321098765";
const appSecret = "test-meta-secret-1234567890";
const account = { id: "local-id", igUserId: "178414123456", username: "creator" };
const token = "test-access-token";
const response = (body: unknown) => new Response(JSON.stringify(body));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("META_CONFIG_ID", configId);
  vi.stubEnv("APP_SECRET", "test-session-secret-with-at-least-32-characters");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost/test");
  vi.stubEnv("APP_URL", "https://autodm.example.com");
  mocks.getSettings.mockResolvedValue({ "meta.appId": appId, "meta.appSecret": appSecret });
  mocks.upsertAccount.mockResolvedValue(account);
  mocks.getActiveAccount.mockResolvedValue(account);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Unified Login", () => {
  it("uses the configuration dialog and a signed state, without legacy scopes", async () => {
    const { state, cookieValue } = createOAuthState();
    const url = new URL(await buildAuthorizeUrl(state));
    expect(url.origin + url.pathname).toBe("https://www.facebook.com/dialog/oauth");
    expect(url.searchParams.get("config_id")).toBe(configId);
    expect(url.searchParams.get("client_id")).toBe(appId);
    expect(url.searchParams.get("state")).toBe(state);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://autodm.example.com/api/instagram/oauth/callback",
    );
    expect(url.searchParams.has("scope")).toBe(false);
    expect(url.searchParams.has("enable_fb_login")).toBe(false);
    expect(verifyOAuthState(state, cookieValue)).toBe(true);
    expect(verifyOAuthState("tampered", cookieValue)).toBe(false);
    expect(verifyOAuthState(state, undefined)).toBe(false);
  });

  it("exchanges once, discovers the IG asset, stores metadata and subscribes that account", async () => {
    const bodies = [
      { access_token: token },
      { client_business_id: "12345" },
      { data: [{ id: account.igUserId, username: "creator" }] },
      { success: true },
      { data: [{ subscribed_fields: ["comments", "messaging_postbacks"] }] },
    ];
    const fetchMock = vi.fn(async () => response(bodies.shift()));
    vi.stubGlobal("fetch", fetchMock);
    expect(await completeOAuth("test-code")).toEqual({ account, subscribed: true });
    const urls = fetchMock.mock.calls.map((call) => new URL((call as unknown as [URL])[0]));
    expect(urls.map((u) => u.pathname)).toEqual([
      "/v27.0/oauth/access_token",
      "/v27.0/me",
      "/v27.0/me/assigned_instagram_accounts",
      `/v27.0/${account.igUserId}/subscribed_apps`,
      `/v27.0/${account.igUserId}/subscribed_apps`,
    ]);
    expect(urls.every((u) => u.origin === "https://graph.facebook.com")).toBe(true);
    expect(urls[0]!.searchParams.get("client_secret")).toBe(appSecret);
    expect(mocks.upsertAccount).toHaveBeenCalledWith({
      igUserId: account.igUserId,
      username: "creator",
      accessToken: token,
      expiresInSeconds: null,
    });
    expect(mocks.setSetting).toHaveBeenCalledWith("meta.unifiedConnection", {
      igUserId: account.igUserId,
      businessId: "12345",
      configId,
    });
  });

  it("refuses multiple shared accounts rather than silently selecting one", async () => {
    const bodies = [
      { access_token: token },
      { client_business_id: "12345" },
      {
        data: [
          { id: "1", username: "a" },
          { id: "2", username: "b" },
        ],
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(bodies.shift())),
    );
    await expect(completeOAuth("code")).rejects.toMatchObject({ code: "profile_fetch_failed" });
    expect(mocks.upsertAccount).not.toHaveBeenCalled();
  });

  it("does not store an account after a failed code exchange", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 190, message: "Invalid code" } }), { status: 400 }),
      ),
    );
    await expect(completeOAuth("bad-code")).rejects.toMatchObject({ code: "token_exchange_failed" });
    expect(mocks.upsertAccount).not.toHaveBeenCalled();
  });

  it("keeps the legacy authorization URL when not enabled", async () => {
    vi.stubEnv("META_CONFIG_ID", undefined);
    const url = new URL(await buildAuthorizeUrl("state"));
    expect(url.origin).toBe("https://www.instagram.com");
    expect(url.searchParams.get("scope")).toContain("instagram_business_basic");
    expect(url.searchParams.has("config_id")).toBe(false);
  });

  it("rejects invalid config IDs", async () => {
    vi.stubEnv("META_CONFIG_ID", "not-a-config-id");
    await expect(buildAuthorizeUrl("state")).rejects.toThrow("META_CONFIG_ID");
  });
});
