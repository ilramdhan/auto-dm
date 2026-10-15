import { describe, expect, it } from "vitest";
import { SKIP_REASON_EXPLANATIONS, skipReasonExplanation } from "./labels";
import {
  createThrottle,
  matchLabel,
  WEBHOOK_REQUEST_RESULTS,
  WEBHOOK_RESULT_META,
  webhookVerdict,
  type WebhookRequestSummary,
} from "./webhook-diagnostics";

const t = (min: number) => new Date(Date.UTC(2026, 9, 15, 12, min));
const row = (p: Partial<WebhookRequestSummary> & Pick<WebhookRequestSummary, "kind" | "result">) =>
  ({
    commentEvents: null,
    matchedEntries: null,
    entries: null,
    createdAt: t(0),
    ...p,
  }) as WebhookRequestSummary;

describe("webhookVerdict", () => {
  it("never_received when nothing was recorded or only failed handshakes", () => {
    expect(webhookVerdict([])).toBe("never_received");
    expect(webhookVerdict([row({ kind: "verification", result: "forbidden" })])).toBe("never_received");
  });

  it("verified_only when the handshake succeeded but no delivery arrived", () => {
    expect(webhookVerdict([row({ kind: "verification", result: "verified" })])).toBe("verified_only");
  });

  it("rejected when the newest delivery failed, even after older successes", () => {
    const rows = [
      row({ kind: "delivery", result: "accepted", entries: 1, matchedEntries: 1, createdAt: t(1) }),
      row({ kind: "delivery", result: "signature_invalid", createdAt: t(5) }),
    ];
    expect(webhookVerdict(rows)).toBe("rejected");
  });

  it("ok after a rejection is followed by a success", () => {
    const rows = [
      row({ kind: "delivery", result: "accepted", entries: 1, matchedEntries: 1, createdAt: t(9) }),
      row({ kind: "delivery", result: "signature_invalid", createdAt: t(5) }),
    ];
    expect(webhookVerdict(rows)).toBe("ok");
  });

  it("other_account when every accepted delivery was for a different account id", () => {
    const rows = [row({ kind: "delivery", result: "accepted", entries: 1, matchedEntries: 0 })];
    expect(webhookVerdict(rows)).toBe("other_account");
  });

  it("ok when no account was connected at the time (match unknown)", () => {
    expect(webhookVerdict([row({ kind: "delivery", result: "accepted", entries: 1 })])).toBe("ok");
  });
});

describe("matchLabel", () => {
  it("describes how entries relate to the connected account", () => {
    expect(matchLabel({ entries: null, matchedEntries: null })).toBe("—");
    expect(matchLabel({ entries: 1, matchedEntries: null })).toBe("No account connected");
    expect(matchLabel({ entries: 0, matchedEntries: 0 })).toBe("No entries");
    expect(matchLabel({ entries: 2, matchedEntries: 2 })).toBe("Your account");
    expect(matchLabel({ entries: 1, matchedEntries: 0 })).toBe("Other account");
    expect(matchLabel({ entries: 3, matchedEntries: 1 })).toBe("1 of 3 for your account");
  });
});

describe("WEBHOOK_RESULT_META", () => {
  it("has a text label for every result (status is never colour-only)", () => {
    for (const r of WEBHOOK_REQUEST_RESULTS) {
      expect(WEBHOOK_RESULT_META[r].label.length).toBeGreaterThan(0);
      expect(WEBHOOK_RESULT_META[r].help.length).toBeGreaterThan(0);
    }
  });
});

describe("createThrottle", () => {
  it("allows `limit` events per window and resets afterwards", () => {
    const allow = createThrottle(2, 1000);
    expect([allow(0), allow(10), allow(20)]).toEqual([true, true, false]);
    expect(allow(999)).toBe(false);
    expect(allow(1000)).toBe(true);
  });
});

describe("skipReasonExplanation", () => {
  it("explains own_comment with the second-account hint", () => {
    expect(skipReasonExplanation("own_comment")).toMatch(/second account/);
    expect(skipReasonExplanation("own_comment")).toMatch(/Instagram Tester/);
  });

  it("covers the confusing reasons and returns null otherwise", () => {
    for (const r of ["account_mismatch", "no_match", "processing_disabled"]) {
      expect(SKIP_REASON_EXPLANATIONS[r]).toBeTruthy();
    }
    expect(skipReasonExplanation("empty_comment")).toBeNull();
    expect(skipReasonExplanation(null)).toBeNull();
    expect(skipReasonExplanation("unknown_reason")).toBeNull();
  });
});
