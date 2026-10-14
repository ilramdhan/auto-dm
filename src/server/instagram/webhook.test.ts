import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkVerifyRequest, extractCommentEvents, parseWebhookPayload, verifySignature } from "./webhook";

const SECRET = "0123456789abcdef0123456789abcdef";
const sign = (body: string, secret = SECRET) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

const commentPayload = {
  object: "instagram",
  entry: [
    {
      id: "17841400000000001",
      time: 1760000000,
      changes: [
        {
          field: "comments",
          value: {
            from: { id: "232323232", username: "commenter", self_ig_scoped_id: "999" },
            media: { id: "18000000000000001", media_product_type: "REELS" },
            id: "17865799348089039",
            text: "DRIVE 🙏",
            future_field: { nested: true },
          },
        },
      ],
    },
  ],
};

describe("verifySignature", () => {
  const body = JSON.stringify(commentPayload);

  it("accepts a valid signature", () => {
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
    expect(
      verifySignature(Buffer.from(body), sign(body).toUpperCase().replace("SHA256=", "sha256="), SECRET),
    ).toBe(true);
  });

  it("rejects wrong secret, tampered body, bad format and missing header", () => {
    expect(verifySignature(body, sign(body, "another-secret-another-secret"), SECRET)).toBe(false);
    expect(verifySignature(`${body} `, sign(body), SECRET)).toBe(false);
    expect(verifySignature(body, sign(body).replace("sha256=", "sha1="), SECRET)).toBe(false);
    expect(verifySignature(body, sign(body).slice(0, -2), SECRET)).toBe(false);
    expect(verifySignature(body, "sha256=zz", SECRET)).toBe(false);
    expect(verifySignature(body, null, SECRET)).toBe(false);
    expect(verifySignature(body, sign(body), "")).toBe(false);
  });

  it("is sensitive to the exact raw bytes (unicode)", () => {
    const raw = '{"text":"caf\\u00e9"}';
    expect(verifySignature(raw, sign(raw), SECRET)).toBe(true);
    expect(verifySignature('{"text":"café"}', sign(raw), SECRET)).toBe(false);
  });
});

describe("checkVerifyRequest", () => {
  const p = (q: string) => new URLSearchParams(q);
  it("returns the challenge for a matching token", () => {
    expect(
      checkVerifyRequest(p("hub.mode=subscribe&hub.verify_token=tok123&hub.challenge=1158201444"), "tok123"),
    ).toBe("1158201444");
  });
  it("rejects wrong mode/token/missing challenge/unsafe challenge", () => {
    expect(
      checkVerifyRequest(p("hub.mode=unsubscribe&hub.verify_token=tok123&hub.challenge=1"), "tok123"),
    ).toBeNull();
    expect(
      checkVerifyRequest(p("hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1"), "tok123"),
    ).toBeNull();
    expect(checkVerifyRequest(p("hub.mode=subscribe&hub.verify_token=tok123"), "tok123")).toBeNull();
    expect(
      checkVerifyRequest(p("hub.mode=subscribe&hub.verify_token=tok123&hub.challenge=<script>"), "tok123"),
    ).toBeNull();
    expect(checkVerifyRequest(p("hub.mode=subscribe&hub.verify_token=&hub.challenge=1"), "")).toBeNull();
  });
});

describe("parseWebhookPayload / extractCommentEvents", () => {
  it("extracts a comment event and tolerates unknown fields", () => {
    const payload = parseWebhookPayload(JSON.stringify(commentPayload));
    expect(payload).not.toBeNull();
    expect(extractCommentEvents(payload!)).toEqual([
      {
        commentId: "17865799348089039",
        text: "DRIVE 🙏",
        igUserId: "17841400000000001",
        fromId: "232323232",
        fromUsername: "commenter",
        mediaId: "18000000000000001",
        mediaProductType: "REELS",
        parentId: null,
      },
    ]);
  });

  it("captures parent_id for replies and coerces numeric ids", () => {
    const payload = parseWebhookPayload(
      JSON.stringify({
        object: "instagram",
        entry: [
          {
            id: 1784,
            changes: [
              { field: "comments", value: { id: 42, text: "drive", from: { id: 7 }, parent_id: "41" } },
            ],
          },
        ],
      }),
    )!;
    const [e] = extractCommentEvents(payload);
    expect(e).toMatchObject({
      commentId: "42",
      igUserId: "1784",
      fromId: "7",
      fromUsername: null,
      parentId: "41",
      mediaId: null,
    });
  });

  it("ignores other fields, other objects, malformed values and duplicates", () => {
    const payload = parseWebhookPayload(
      JSON.stringify({
        object: "instagram",
        entry: [
          {
            id: "1",
            messaging: [{ sender: { id: "x" } }],
            changes: [
              { field: "mentions", value: { comment_id: "5", media_id: "6" } },
              { field: "comments", value: { text: "no id" } },
              { field: "comments", value: { id: "c1", from: { id: "u1" }, text: "a" } },
              { field: "comments", value: { id: "c1", from: { id: "u1" }, text: "a" } },
            ],
          },
          { id: "2" },
        ],
      }),
    )!;
    expect(extractCommentEvents(payload).map((e) => e.commentId)).toEqual(["c1"]);
    expect(extractCommentEvents({ object: "page", entry: payload.entry })).toEqual([]);
  });

  it("defaults missing text to empty string", () => {
    const payload = parseWebhookPayload(
      JSON.stringify({
        object: "instagram",
        entry: [{ id: "1", changes: [{ field: "comments", value: { id: "c", from: { id: "u" } } }] }],
      }),
    )!;
    expect(extractCommentEvents(payload)[0]?.text).toBe("");
  });

  it("returns null for invalid JSON or shape", () => {
    expect(parseWebhookPayload("not json")).toBeNull();
    expect(parseWebhookPayload("{}")).toBeNull();
    expect(parseWebhookPayload(JSON.stringify({ object: "instagram", entry: "x" }))).toBeNull();
  });
});
