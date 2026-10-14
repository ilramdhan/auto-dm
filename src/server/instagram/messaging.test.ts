import { afterEach, describe, expect, it, vi } from "vitest";
import { GRAPH_BASE_URL } from "./constants";
import { replyToComment, sendPrivateReply, textWithLink } from "./messaging";

type FetchFn = (url: URL, init: RequestInit) => Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

function bodyOf(call: unknown[]): unknown {
  return JSON.parse(String((call[1] as RequestInit).body));
}

describe("replyToComment", () => {
  it("posts the message as a form field to /{comment-id}/replies", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => json({ id: "reply-1" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(replyToComment("tok", "c1", "Check your DM!")).resolves.toEqual({ id: "reply-1" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe(`${GRAPH_BASE_URL}/c1/replies?access_token=tok`);
    expect(String(init.body)).toBe("message=Check+your+DM%21");
  });
});

describe("sendPrivateReply", () => {
  it("sends plain text with recipient.comment_id", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => json({ recipient_id: "u", message_id: "m1" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await sendPrivateReply({
      accessToken: "tok",
      igUserId: "178",
      commentId: "c1",
      text: "hello",
    });
    expect(res).toEqual({ messageId: "m1", format: "text" });
    expect(fetchMock.mock.calls[0]![0].toString()).toBe(`${GRAPH_BASE_URL}/178/messages?access_token=tok`);
    expect(bodyOf(fetchMock.mock.calls[0]!)).toEqual({
      recipient: { comment_id: "c1" },
      message: { text: "hello" },
    });
  });

  it("truncates text to 1000 chars", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => json({ message_id: "m1" }));
    vi.stubGlobal("fetch", fetchMock);
    await sendPrivateReply({ accessToken: "t", igUserId: "1", commentId: "c", text: "x".repeat(1500) });
    const body = bodyOf(fetchMock.mock.calls[0]!) as { message: { text: string } };
    expect(Array.from(body.message.text)).toHaveLength(1000);
  });

  it("uses a button template when a button is configured", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => json({ message_id: "m2" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await sendPrivateReply({
      accessToken: "t",
      igUserId: "1",
      commentId: "c",
      text: "Here you go",
      button: { title: "Open the Google Drive folder", url: "https://example.com/x" },
    });
    expect(res.format).toBe("button");
    expect(bodyOf(fetchMock.mock.calls[0]!)).toEqual({
      recipient: { comment_id: "c" },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "Here you go",
            buttons: [{ type: "web_url", url: "https://example.com/x", title: "Open the Google Dri…" }],
          },
        },
      },
    });
  });

  it("falls back to text + link when the template is rejected", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { message: "Invalid parameter", code: 100 } }, 400))
      .mockResolvedValueOnce(json({ message_id: "m3" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await sendPrivateReply({
      accessToken: "t",
      igUserId: "1",
      commentId: "c",
      text: "Here you go",
      button: { title: "Open", url: "https://example.com/x" },
    });
    expect(res).toEqual({
      messageId: "m3",
      format: "text",
      templateFallback: { code: 100, message: "Invalid parameter" },
    });
    expect(bodyOf(fetchMock.mock.calls[1]!)).toEqual({
      recipient: { comment_id: "c" },
      message: { text: "Here you go\n\nOpen: https://example.com/x" },
    });
  });

  it("does not fall back on auth errors", async () => {
    const fetchMock = vi.fn(async () => json({ error: { message: "expired", code: 190 } }, 400));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendPrivateReply({
        accessToken: "t",
        igUserId: "1",
        commentId: "c",
        text: "x",
        button: { title: "Open", url: "https://e.com" },
      }),
    ).rejects.toMatchObject({ code: 190 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends long text with the link appended instead of a template", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => json({ message_id: "m4" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await sendPrivateReply({
      accessToken: "t",
      igUserId: "1",
      commentId: "c",
      text: "y".repeat(900),
      button: { title: "Open", url: "https://example.com/x" },
    });
    expect(res.format).toBe("text");
    const body = bodyOf(fetchMock.mock.calls[0]!) as { message: { text: string } };
    expect(Array.from(body.message.text).length).toBeLessThanOrEqual(1000);
    expect(body.message.text.endsWith("Open: https://example.com/x")).toBe(true);
  });
});

describe("textWithLink", () => {
  it("keeps the link intact within 1000 chars", () => {
    const out = textWithLink("z".repeat(2000), { title: "Go", url: "https://example.com" });
    expect(Array.from(out)).toHaveLength(1000);
    expect(out.endsWith("Go: https://example.com")).toBe(true);
  });
});
