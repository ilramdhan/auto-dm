import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GRAPH_BASE_URL } from "./constants";
import { GraphApiError, graphRequest, safeErrorMessage } from "./graph";

type FetchFn = (url: URL, init: RequestInit) => Promise<Response>;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const graphError = (code: number, status = 400) =>
  json(
    { error: { message: "(#100) Bad", type: "OAuthException", code, error_subcode: 33, fbtrace_id: "Abc" } },
    status,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("graphRequest", () => {
  it("builds the versioned URL, sends the token as a query param and parses the response", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => json({ id: "1", extra: true }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await graphRequest({
      path: "/me",
      accessToken: "TOKEN",
      query: { fields: "id" },
      schema: z.object({ id: z.string() }),
    });
    expect(res).toEqual({ id: "1" });
    const url = fetchMock.mock.calls[0]![0];
    expect(url.toString()).toBe(`${GRAPH_BASE_URL}/me?fields=id&access_token=TOKEN`);
  });

  it("sends form bodies", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => json({ id: "r1" }));
    vi.stubGlobal("fetch", fetchMock);
    await graphRequest({
      method: "POST",
      path: "/123/replies",
      form: { message: "hi there" },
      schema: z.object({ id: z.string() }),
    });
    const init = fetchMock.mock.calls[0]![1];
    expect(init.method).toBe("POST");
    expect(String(init.body)).toBe("message=hi+there");
  });

  it("throws a typed GraphApiError with code/subcode/trace", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => graphError(100)),
    );
    const err = await graphRequest({ path: "/me", schema: z.unknown() }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GraphApiError);
    expect(err).toMatchObject({ status: 400, code: 100, subcode: 33, fbtraceId: "Abc" });
    expect((err as GraphApiError).toSafeString()).toContain("code=100");
  });

  it("parses api.instagram.com OAuth errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({ error_type: "OAuthException", code: 400, error_message: "Invalid code" }, 400),
      ),
    );
    await expect(
      graphRequest({ path: "https://api.instagram.com/oauth/access_token", schema: z.unknown() }),
    ).rejects.toMatchObject({
      message: "Invalid code",
      code: 400,
    });
  });

  it("retries GET on 5xx up to 2 times", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({}, 500))
      .mockResolvedValueOnce(json({}, 503, { "retry-after": "0" }))
      .mockResolvedValueOnce(json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(graphRequest({ path: "/me", schema: z.object({ ok: z.boolean() }) })).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after max retries", async () => {
    const fetchMock = vi.fn(async () => json({}, 502, { "retry-after": "0" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(graphRequest({ path: "/me", schema: z.unknown() })).rejects.toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-idempotent POST on 5xx, but does on 429", async () => {
    const f1 = vi.fn(async () => json({}, 500));
    vi.stubGlobal("fetch", f1);
    await expect(graphRequest({ method: "POST", path: "/x", schema: z.unknown() })).rejects.toBeInstanceOf(
      GraphApiError,
    );
    expect(f1).toHaveBeenCalledTimes(1);

    const f2 = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429, { "retry-after": "0" }))
      .mockResolvedValueOnce(json({ id: "1" }));
    vi.stubGlobal("fetch", f2);
    await expect(
      graphRequest({ method: "POST", path: "/x", schema: z.object({ id: z.string() }) }),
    ).resolves.toEqual({ id: "1" });
    expect(f2).toHaveBeenCalledTimes(2);
  });

  it("does not retry 4xx", async () => {
    const fetchMock = vi.fn(async () => graphError(190));
    vi.stubGlobal("fetch", fetchMock);
    const err = (await graphRequest({ path: "/me", schema: z.unknown() }).catch(
      (e: unknown) => e,
    )) as GraphApiError;
    expect(err.isAuthError).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps network failures without leaking the URL/token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed https://graph.instagram.com/me?access_token=SECRET");
      }),
    );
    const err = (await graphRequest({
      method: "POST",
      path: "/me",
      accessToken: "SECRET",
      schema: z.unknown(),
    }).catch((e: unknown) => e)) as GraphApiError;
    expect(err.status).toBe(0);
    expect(err.message).not.toContain("SECRET");
  });

  it("rejects unexpected response shapes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ nope: 1 })),
    );
    await expect(graphRequest({ path: "/me", schema: z.object({ id: z.string() }) })).rejects.toThrow(
      /Unexpected/,
    );
  });
});

describe("safeErrorMessage", () => {
  it("redacts provided secrets and token-looking strings, and truncates", () => {
    const token = "IGAAB" + "x".repeat(60);
    expect(safeErrorMessage(new Error(`bad ${token}`), [token])).toBe("bad [redacted]");
    expect(safeErrorMessage(new Error(`bad ${token}`))).toBe("bad [redacted]");
    expect(safeErrorMessage(new Error("url?access_token=abc&x=1"))).toBe("url?access_token=[redacted]&x=1");
    expect(safeErrorMessage(new Error("a".repeat(600)), [], 100)).toHaveLength(100);
    expect(safeErrorMessage("weird")).toBe("Unknown error");
  });
});
