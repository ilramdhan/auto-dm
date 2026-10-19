import { afterEach, describe, expect, it, vi } from "vitest";
import { GRAPH_BASE_URL } from "./constants";
import { commentsPageSchema, fetchRecentComments, flattenCommentsPage, nextCommentsCursor } from "./comments";

type FetchFn = (url: URL, init: RequestInit) => Promise<Response>;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const since = new Date("2026-10-12T12:00:00Z");
const c = (id: string, ts: string, over: Record<string, unknown> = {}) => ({
  id,
  text: `text ${id}`,
  timestamp: ts,
  from: { id: `u_${id}`, username: `user_${id}` },
  ...over,
});

describe("flattenCommentsPage", () => {
  it("parses Meta's timestamp format, flattens replies and drops old or anonymous comments", () => {
    const page = commentsPageSchema.parse({
      data: [
        c("1", "2026-10-19T03:20:00+0000", {
          replies: { data: [c("1a", "2026-10-19T04:00:00+0000"), c("1b", "2026-10-01T04:00:00+0000")] },
        }),
        c("2", "2026-10-18T03:20:00+0000", { from: undefined, username: "nofrom" }),
        c("3", "2026-10-01T00:00:00+0000"),
        c("4", "not a date"),
        { id: 5, timestamp: "2026-10-18T00:00:00+0000", from: { id: 55 }, username: "fallback" },
      ],
    });
    const out = flattenCommentsPage(page, { mediaId: "m1", since });
    expect(out).toEqual([
      {
        commentId: "1",
        mediaId: "m1",
        text: "text 1",
        createdAt: new Date("2026-10-19T03:20:00Z"),
        fromId: "u_1",
        fromUsername: "user_1",
        parentId: null,
      },
      expect.objectContaining({ commentId: "1a", parentId: "1", fromId: "u_1a" }),
      expect.objectContaining({ commentId: "5", fromId: "55", fromUsername: "fallback", text: "" }),
    ]);
  });

  it("rejects responses without a data array", () => {
    expect(commentsPageSchema.safeParse({ comments: [] }).success).toBe(false);
  });
});

describe("nextCommentsCursor", () => {
  it("stops when there's no next page or the page reached older comments", () => {
    const page = (ts: string, next?: string) =>
      commentsPageSchema.parse({ data: [c("1", ts)], paging: { cursors: { after: "AFT" }, next } });
    expect(nextCommentsCursor(page("2026-10-19T00:00:00+0000", "https://x"), since)).toBe("AFT");
    expect(nextCommentsCursor(page("2026-10-19T00:00:00+0000"), since)).toBeNull();
    expect(nextCommentsCursor(page("2026-10-01T00:00:00+0000", "https://x"), since)).toBeNull();
  });
});

describe("fetchRecentComments", () => {
  it("follows the after cursor on graph.instagram.com, never the paging.next URL", async () => {
    const fetchMock = vi.fn<FetchFn>(async (url) =>
      url.searchParams.get("after") === "P2"
        ? json({ data: [c("2", "2026-10-17T00:00:00+0000")] })
        : json({
            data: [c("1", "2026-10-18T00:00:00+0000")],
            paging: { cursors: { after: "P2" }, next: "https://evil.example/next" },
          }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchRecentComments({ accessToken: "tok", mediaId: "m1", since });
    expect(res).toMatchObject({ pages: 2, truncated: false });
    expect(res.comments.map((x) => x.commentId)).toEqual(["1", "2"]);
    for (const [url] of fetchMock.mock.calls) {
      expect(url.origin + url.pathname).toBe(`${GRAPH_BASE_URL}/m1/comments`);
      expect(url.searchParams.get("fields")).toContain("replies{");
      expect(url.searchParams.get("limit")).toBe("50");
    }
  });

  it("caps the number of pages and reports truncation", async () => {
    let n = 0;
    const fetchMock = vi.fn<FetchFn>(async () =>
      json({
        data: [c(String(++n), "2026-10-18T00:00:00+0000")],
        paging: { cursors: { after: `P${n}` }, next: "https://x" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchRecentComments({ accessToken: "tok", mediaId: "m1", since, maxPages: 3 });
    expect(res).toMatchObject({ pages: 3, truncated: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries a 500 and does not retry a 400", async () => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn<FetchFn>(async () =>
        ++calls === 1 ? json({ error: { message: "boom", code: 2 } }, 500) : json({ data: [] }),
      ),
    );
    const p = fetchRecentComments({ accessToken: "tok", mediaId: "m1", since });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toMatchObject({ pages: 1, comments: [] });
    expect(calls).toBe(2);

    const bad = vi.fn<FetchFn>(async () => json({ error: { message: "(#100) Invalid", code: 100 } }, 400));
    vi.stubGlobal("fetch", bad);
    await expect(fetchRecentComments({ accessToken: "tok", mediaId: "m1", since })).rejects.toMatchObject({
      name: "GraphApiError",
      code: 100,
    });
    expect(bad).toHaveBeenCalledTimes(1);
  });
});
