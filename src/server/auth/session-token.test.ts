import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { signSessionToken, verifySessionToken } from "./session-token";

const key = new TextEncoder().encode("k".repeat(32));
const otherKey = new TextEncoder().encode("o".repeat(32));

describe("session tokens", () => {
  it("round-trips sub and ver", async () => {
    const token = await signSessionToken({ sub: "user-1", ver: 3 }, key);
    await expect(verifySessionToken(token, key)).resolves.toEqual({ sub: "user-1", ver: 3 });
  });
  it("rejects a token signed with another key", async () => {
    const token = await signSessionToken({ sub: "user-1", ver: 1 }, otherKey);
    await expect(verifySessionToken(token, key)).resolves.toBeNull();
  });
  it("rejects expired tokens", async () => {
    const token = await signSessionToken({ sub: "user-1", ver: 1 }, key, -10);
    await expect(verifySessionToken(token, key)).resolves.toBeNull();
  });
  it("rejects tampered or foreign tokens", async () => {
    const token = await signSessionToken({ sub: "user-1", ver: 1 }, key);
    const [h, , s] = token.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: "admin", ver: 1 })).toString("base64url")}.${s}`;
    await expect(verifySessionToken(forged, key)).resolves.toBeNull();
    const foreign = await new SignJWT({ ver: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("x")
      .setExpirationTime("1h")
      .sign(key);
    await expect(verifySessionToken(foreign, key)).resolves.toBeNull(); // wrong issuer/audience
    await expect(verifySessionToken("garbage", key)).resolves.toBeNull();
  });
});
