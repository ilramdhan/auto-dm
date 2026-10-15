import { describe, expect, it } from "vitest";
import { expectedOrigins, isSameOriginRequest, normalizeOrigin } from "./same-origin";

const allowedOrigins = ["https://app.example"];

describe("normalizeOrigin", () => {
  it("returns the canonical origin of http(s) URLs", () => {
    expect(normalizeOrigin("https://APP.example:443/login?x=1")).toBe("https://app.example");
    expect(normalizeOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it.each([null, undefined, "", "null", "not a url", "javascript:alert(1)", "file:///etc/passwd"])(
    "rejects %j",
    (raw) => {
      expect(normalizeOrigin(raw)).toBeNull();
    },
  );
});

describe("isSameOriginRequest", () => {
  it("accepts a same-origin form post", () => {
    expect(
      isSameOriginRequest({ origin: "https://app.example", secFetchSite: "same-origin", allowedOrigins }),
    ).toBe(true);
  });

  it("accepts a matching Origin when Sec-Fetch-Site is missing (older browsers)", () => {
    expect(isSameOriginRequest({ origin: "https://app.example", secFetchSite: null, allowedOrigins })).toBe(
      true,
    );
  });

  it("accepts Sec-Fetch-Site same-origin when Origin is missing", () => {
    expect(isSameOriginRequest({ origin: null, secFetchSite: "same-origin", allowedOrigins })).toBe(true);
    expect(isSameOriginRequest({ origin: "null", secFetchSite: "Same-Origin", allowedOrigins })).toBe(true);
  });

  it.each(["cross-site", "same-site", "none"])("rejects Sec-Fetch-Site %s", (site) => {
    expect(isSameOriginRequest({ origin: "https://app.example", secFetchSite: site, allowedOrigins })).toBe(
      false,
    );
  });

  it("rejects a foreign Origin even with Sec-Fetch-Site same-origin", () => {
    expect(
      isSameOriginRequest({ origin: "https://evil.example", secFetchSite: "same-origin", allowedOrigins }),
    ).toBe(false);
  });

  it("rejects a foreign or look-alike Origin", () => {
    for (const origin of ["https://evil.example", "http://app.example", "https://app.example.evil.example"]) {
      expect(isSameOriginRequest({ origin, secFetchSite: null, allowedOrigins })).toBe(false);
    }
  });

  it("rejects a request without either header", () => {
    expect(isSameOriginRequest({ origin: null, secFetchSite: null, allowedOrigins })).toBe(false);
    expect(isSameOriginRequest({ origin: "null", secFetchSite: null, allowedOrigins })).toBe(false);
  });
});

describe("expectedOrigins", () => {
  const headers = (entries: Record<string, string>) => new Headers(entries);

  it("includes the request URL origin and the public base URL", () => {
    expect(
      expectedOrigins("http://localhost:3000/api/auth/logout", headers({}), "https://app.example"),
    ).toEqual(["http://localhost:3000", "https://app.example"]);
  });

  it("includes the host seen by a reverse proxy", () => {
    const origins = expectedOrigins(
      "http://0.0.0.0:3000/api/auth/logout",
      headers({ "x-forwarded-host": "dm.example.com", "x-forwarded-proto": "https" }),
      null,
    );
    expect(origins).toContain("https://dm.example.com");
  });

  it("falls back to the request protocol for the Host header", () => {
    const origins = expectedOrigins(
      "https://a.example/api/auth/logout",
      headers({ host: "b.example" }),
      null,
    );
    expect(origins).toEqual(["https://a.example", "https://b.example"]);
  });

  it("ignores an invalid forwarded protocol and invalid base URL", () => {
    const origins = expectedOrigins(
      "https://a.example/x",
      headers({ host: "a.example", "x-forwarded-proto": "javascript" }),
      "not a url",
    );
    expect(origins).toEqual(["https://a.example"]);
  });
});
