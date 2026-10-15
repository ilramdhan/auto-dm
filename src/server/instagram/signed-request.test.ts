import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseSignedRequest } from "./signed-request";

const SECRET = "test-app-secret-0123456789abcdef";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: unknown, secret = SECRET, opts: { pad?: boolean } = {}): string {
  let encoded = b64url(JSON.stringify(payload));
  if (opts.pad) encoded += "=".repeat((4 - (encoded.length % 4)) % 4);
  let sig = b64url(createHmac("sha256", secret).update(encoded).digest());
  if (opts.pad) sig += "=".repeat((4 - (sig.length % 4)) % 4);
  return `${sig}.${encoded}`;
}

const valid = { algorithm: "HMAC-SHA256", issued_at: 1_790_000_000, user_id: "17841400000000001" };

describe("parseSignedRequest", () => {
  it("accepts a correctly signed request", () => {
    expect(parseSignedRequest(sign(valid), SECRET)).toEqual({
      userId: "17841400000000001",
      issuedAt: 1_790_000_000,
    });
  });

  it("omits issuedAt when Meta doesn't send it", () => {
    expect(parseSignedRequest(sign({ algorithm: "HMAC-SHA256", user_id: "42" }), SECRET)).toEqual({
      userId: "42",
    });
  });

  it("matches the algorithm case-insensitively", () => {
    expect(parseSignedRequest(sign({ ...valid, algorithm: "hmac-sha256" }), SECRET)?.userId).toBe(
      valid.user_id,
    );
  });

  it("converts a numeric user_id to a string", () => {
    expect(parseSignedRequest(sign({ ...valid, user_id: 1234567890 }), SECRET)?.userId).toBe("1234567890");
  });

  it("rejects numeric user_ids that lost precision", () => {
    expect(parseSignedRequest(sign({ ...valid, user_id: 2 ** 60 }), SECRET)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const [sig] = sign(valid).split(".");
    const forged = b64url(JSON.stringify({ ...valid, user_id: "999" }));
    expect(parseSignedRequest(`${sig}.${forged}`, SECRET)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const [sig, payload] = sign(valid).split(".") as [string, string];
    const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    expect(parseSignedRequest(`${flipped}.${payload}`, SECRET)).toBeNull();
  });

  it("rejects a truncated signature without throwing", () => {
    const [sig, payload] = sign(valid).split(".") as [string, string];
    expect(parseSignedRequest(`${sig.slice(0, 10)}.${payload}`, SECRET)).toBeNull();
  });

  it("rejects a request signed with another secret", () => {
    expect(parseSignedRequest(sign(valid, "another-secret-0123456789abcdef"), SECRET)).toBeNull();
  });

  it("rejects an empty app secret", () => {
    expect(parseSignedRequest(sign(valid, ""), "")).toBeNull();
  });

  it("rejects other algorithms", () => {
    expect(parseSignedRequest(sign({ ...valid, algorithm: "HMAC-SHA1" }), SECRET)).toBeNull();
    expect(parseSignedRequest(sign({ ...valid, algorithm: "none" }), SECRET)).toBeNull();
    expect(
      parseSignedRequest(sign({ user_id: valid.user_id, issued_at: valid.issued_at }), SECRET),
    ).toBeNull();
  });

  it("rejects a missing or invalid user_id", () => {
    expect(
      parseSignedRequest(sign({ algorithm: valid.algorithm, issued_at: valid.issued_at }), SECRET),
    ).toBeNull();
    expect(parseSignedRequest(sign({ ...valid, user_id: "" }), SECRET)).toBeNull();
    expect(parseSignedRequest(sign({ ...valid, user_id: null }), SECRET)).toBeNull();
    expect(parseSignedRequest(sign({ ...valid, user_id: "a b" }), SECRET)).toBeNull();
    expect(parseSignedRequest(sign({ ...valid, user_id: -1 }), SECRET)).toBeNull();
  });

  it("rejects a signed payload that isn't a JSON object", () => {
    const encoded = b64url("not json");
    const sig = b64url(createHmac("sha256", SECRET).update(encoded).digest());
    expect(parseSignedRequest(`${sig}.${encoded}`, SECRET)).toBeNull();
    expect(parseSignedRequest(sign([1, 2, 3]), SECRET)).toBeNull();
    expect(parseSignedRequest(sign("HMAC-SHA256"), SECRET)).toBeNull();
  });

  it("rejects garbage, empty and oddly-shaped input", () => {
    expect(parseSignedRequest("", SECRET)).toBeNull();
    expect(parseSignedRequest(".", SECRET)).toBeNull();
    expect(parseSignedRequest("abc", SECRET)).toBeNull();
    expect(parseSignedRequest("abc.", SECRET)).toBeNull();
    expect(parseSignedRequest(".abc", SECRET)).toBeNull();
    expect(parseSignedRequest("!!!.???", SECRET)).toBeNull();
    expect(parseSignedRequest("🙂.🙂", SECRET)).toBeNull();
    expect(parseSignedRequest("x".repeat(10_000) + "." + "y", SECRET)).toBeNull();
  });

  it("rejects extra dots", () => {
    const req = sign(valid);
    expect(parseSignedRequest(`${req}.extra`, SECRET)).toBeNull();
    expect(parseSignedRequest(`extra.${req}`, SECRET)).toBeNull();
    expect(parseSignedRequest(req.replace(".", ".."), SECRET)).toBeNull();
  });

  it("accepts padded base64url segments (signature over the padded payload string)", () => {
    // Pick a payload whose encoding needs padding so the variant is actually exercised.
    const padded = { ...valid, user_id: "1784140000000000" };
    const req = sign(padded, SECRET, { pad: true });
    expect(req).toContain("=");
    expect(parseSignedRequest(req, SECRET)?.userId).toBe("1784140000000000");
  });

  it("rejects a valid signature once padding is added to the payload after signing", () => {
    const [sig, payload] = sign(valid).split(".") as [string, string];
    // The HMAC covers the exact encoded string, so changing it (even only padding) must fail.
    expect(parseSignedRequest(`${sig}.${payload}==`, SECRET)).toBeNull();
  });

  it("rejects standard base64 (+ and /) even when the HMAC matches", () => {
    // "?>?" encodes to "Pz4/" in standard base64 ("Pz4_" in base64url).
    const encoded = Buffer.from(JSON.stringify({ ...valid, note: "?>?" })).toString("base64");
    expect(encoded).toMatch(/[+/]/);
    const sig = b64url(createHmac("sha256", SECRET).update(encoded).digest());
    expect(parseSignedRequest(`${sig}.${encoded}`, SECRET)).toBeNull();
  });
});
