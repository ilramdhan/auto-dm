import { afterEach, describe, expect, it, vi } from "vitest";
import { GRAPH_BASE_URL } from "./constants";
import {
  postbackTemplate,
  replyToComment,
  sendDirectMessage,
  sendPostbackMessage,
  sendPrivateReply,
  textWithLink,
} from "./messaging";
import { getUserFollowStatus } from "./user-profile";

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

describe("sendDirectMessage", () => {
  it("sends to recipient.id with the same web_url button template", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => json({ recipient_id: "igsid", message_id: "m5" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await sendDirectMessage("t", "178", "igsid_1", {
      text: "Here",
      button: { title: "Open", url: "https://example.com/x" },
    });
    expect(res).toEqual({ messageId: "m5", format: "button" });
    expect(fetchMock.mock.calls[0]![0].toString()).toBe(`${GRAPH_BASE_URL}/178/messages?access_token=t`);
    expect(bodyOf(fetchMock.mock.calls[0]!)).toEqual({
      recipient: { id: "igsid_1" },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "Here",
            buttons: [{ type: "web_url", url: "https://example.com/x", title: "Open" }],
          },
        },
      },
    });
  });

  it("sends plain text to recipient.id without a button", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => json({ message_id: "m6" }));
    vi.stubGlobal("fetch", fetchMock);
    await sendDirectMessage("t", "178", "igsid_1", { text: "hi" });
    expect(bodyOf(fetchMock.mock.calls[0]!)).toEqual({
      recipient: { id: "igsid_1" },
      message: { text: "hi" },
    });
  });
});

describe("postback template", () => {
  it("builds a button template with one postback button", () => {
    expect(
      postbackTemplate("Follow first", { title: "Saya sudah follow ya kak!!", payload: "fg:abc" }),
    ).toEqual({
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Follow first",
          buttons: [{ type: "postback", title: "Saya sudah follow y…", payload: "fg:abc" }],
        },
      },
    });
  });

  it("truncates the text to 640 chars", () => {
    const t = postbackTemplate("x".repeat(700), { title: "a", payload: "fg:1" });
    expect(Array.from(t.attachment.payload.text)).toHaveLength(640);
  });

  it("sends it as a Private Reply to a comment", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => json({ message_id: "m7" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await sendPostbackMessage(
      "t",
      "178",
      { comment_id: "c1" },
      { text: "Follow", button: { title: "Done", payload: "fg:1" } },
    );
    expect(res).toEqual({ messageId: "m7", format: "button" });
    expect(bodyOf(fetchMock.mock.calls[0]!)).toMatchObject({
      recipient: { comment_id: "c1" },
      message: { attachment: { payload: { buttons: [{ type: "postback", payload: "fg:1" }] } } },
    });
  });

  it("falls back to the plain gate text when the template is rejected", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { message: "Invalid parameter", code: 100 } }, 400))
      .mockResolvedValueOnce(json({ message_id: "m8" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await sendPostbackMessage(
      "t",
      "178",
      { id: "igsid" },
      { text: "Follow", button: { title: "Done", payload: "fg:1" } },
    );
    expect(res).toEqual({
      messageId: "m8",
      format: "text",
      templateFallback: { code: 100, message: "Invalid parameter" },
    });
    expect(bodyOf(fetchMock.mock.calls[1]!)).toEqual({
      recipient: { id: "igsid" },
      message: { text: "Follow" },
    });
  });

  it("does not fall back on auth errors", async () => {
    const fetchMock = vi.fn(async () => json({ error: { message: "expired", code: 190 } }, 400));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendPostbackMessage("t", "1", { id: "x" }, { text: "a", button: { title: "b", payload: "fg:1" } }),
    ).rejects.toMatchObject({ code: 190 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("getUserFollowStatus", () => {
  it.each([true, false])("returns is_user_follow_business=%s", async (v) => {
    const fetchMock = vi.fn<FetchFn>(async () => json({ is_user_follow_business: v, id: "igsid" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getUserFollowStatus("tok", "igsid_1")).resolves.toBe(v);
    expect(fetchMock.mock.calls[0]![0].toString()).toBe(
      `${GRAPH_BASE_URL}/igsid_1?fields=is_user_follow_business&access_token=tok`,
    );
    expect(fetchMock.mock.calls[0]![1].method).toBe("GET");
  });

  it("throws when the field is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<FetchFn>(async () => json({ id: "igsid" })),
    );
    await expect(getUserFollowStatus("tok", "igsid_1")).rejects.toMatchObject({
      name: "GraphApiError",
      message: "Unexpected Instagram API response shape",
    });
  });

  it("retries a 5xx (GET is idempotent)", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ error: { message: "oops", code: 2 } }, 500))
        .mockResolvedValueOnce(json({ is_user_follow_business: true }));
      vi.stubGlobal("fetch", fetchMock);
      const p = getUserFollowStatus("tok", "igsid_1");
      await vi.runAllTimersAsync();
      await expect(p).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry a 4xx", async () => {
    const fetchMock = vi.fn(async () => json({ error: { message: "bad", code: 100 } }, 400));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getUserFollowStatus("tok", "igsid_1")).rejects.toMatchObject({ code: 100 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
