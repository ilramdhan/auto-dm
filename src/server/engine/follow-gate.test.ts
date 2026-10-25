import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FOLLOW_GATE_BUTTON_TITLE } from "@/lib/constants";
import { GraphApiError } from "@/server/instagram/graph";
import type { PostbackEvent } from "@/server/instagram/webhook";
import { handleFollowGatePostback, type FollowGateDeps } from "./follow-gate";
import { followGatePayload, parseFollowGatePayload } from "./follow-gate-payload";

const OUR = "17841400000000001";
const DELIVERY = "0b6f1c3e-1a2b-4c3d-8e9f-001122334455";
const RULE = "9a8b7c6d-1111-4222-8333-444455556666";
const silent = { debug() {}, info() {}, warn() {}, error() {}, child: () => silent };

type State = { status: "pending" | "unlocked" | null };

function setup(over: Partial<FollowGateDeps> = {}, deliveryOver: Record<string, unknown> = {}) {
  const state: State = { status: "pending" };
  const deps: FollowGateDeps = {
    processingEnabled: vi.fn(async () => true),
    getAccount: vi.fn(async () => ({ igUserId: OUR, accessTokenEnc: "enc" })),
    getToken: vi.fn(() => "IGTOKEN_fake_123456"),
    getDelivery: vi.fn(async () => ({
      id: DELIVERY,
      igUserId: OUR,
      commenterId: "igsid_1",
      commenterUsername: "alice",
      ruleId: RULE,
      matchedKeyword: "link",
      followGateStatus: state.status,
      dmStatus: "sent" as const,
      ...deliveryOver,
    })),
    getRule: vi.fn(async () => ({
      id: RULE,
      dmMessage: "Hi {username}, the {keyword}:",
      dmButtonTitle: "Open",
      dmButtonUrl: "https://example.com/x",
      followGateMessage: null,
      followGateButtonTitle: null,
      followGateRetryMessage: "Not yet {username}",
    })),
    // Simulates the conditional UPDATE ... WHERE follow_gate_status is pending or null.
    claimUnlock: vi.fn(async () => {
      if (state.status === "unlocked") return false;
      state.status = "unlocked";
      return true;
    }),
    revertUnlock: vi.fn(async () => {
      if (state.status === "unlocked") state.status = "pending";
    }),
    recordUnlockedMessage: vi.fn(async () => {}),
    isFollowing: vi.fn(async () => true),
    sendDirect: vi.fn(async () => ({ messageId: "mid_dm", format: "button" as const })),
    sendPostback: vi.fn(async () => ({ messageId: "mid_retry", format: "button" as const })),
    ...over,
  };
  return { deps, state };
}

const tap = (over: Partial<PostbackEvent> = {}): PostbackEvent => ({
  igUserId: OUR,
  senderId: "igsid_1",
  recipientId: OUR,
  payload: followGatePayload(DELIVERY),
  mid: "m1",
  timestamp: 1,
  ...over,
});

describe("follow gate payload", () => {
  it("round-trips a delivery id", () => {
    expect(followGatePayload(DELIVERY)).toBe(`fg:${DELIVERY}`);
    expect(parseFollowGatePayload(`fg:${DELIVERY}`)).toBe(DELIVERY);
  });
  it.each(["", "fg:", "fg:not-a-uuid", `xx:${DELIVERY}`, DELIVERY, `fg:${DELIVERY}x`])("rejects %j", (p) => {
    expect(parseFollowGatePayload(p)).toBeNull();
  });
});

describe("handleFollowGatePostback", () => {
  it("following: unlocks and sends the rule's DM with its link once", async () => {
    const { deps, state } = setup();
    await expect(handleFollowGatePostback(tap(), { deps, log: silent })).resolves.toBe("unlocked");
    expect(deps.isFollowing).toHaveBeenCalledWith("IGTOKEN_fake_123456", "igsid_1");
    expect(deps.sendDirect).toHaveBeenCalledTimes(1);
    expect(deps.sendDirect).toHaveBeenCalledWith("IGTOKEN_fake_123456", OUR, "igsid_1", {
      text: "Hi alice, the link:",
      button: { title: "Open", url: "https://example.com/x" },
    });
    expect(deps.recordUnlockedMessage).toHaveBeenCalledWith(DELIVERY, "mid_dm");
    expect(state.status).toBe("unlocked");
    expect(deps.sendPostback).not.toHaveBeenCalled();
  });

  it("double tap (concurrent): only one DM is sent", async () => {
    const { deps } = setup();
    const results = await Promise.all([
      handleFollowGatePostback(tap(), { deps, log: silent }),
      handleFollowGatePostback(tap({ mid: "m2" }), { deps, log: silent }),
    ]);
    expect(results.sort()).toEqual(["ignored_not_pending", "unlocked"]);
    expect(deps.sendDirect).toHaveBeenCalledTimes(1);
  });

  it("tap after unlocking is ignored without calling Instagram", async () => {
    const { deps } = setup({}, { followGateStatus: "unlocked" });
    await expect(handleFollowGatePostback(tap(), { deps, log: silent })).resolves.toBe("ignored_not_pending");
    expect(deps.isFollowing).not.toHaveBeenCalled();
    expect(deps.sendDirect).not.toHaveBeenCalled();
  });

  it("gate message recorded as failed (timed out) but delivered: the tap still unlocks", async () => {
    const { deps, state } = setup({}, { dmStatus: "failed" });
    state.status = null;
    await expect(handleFollowGatePostback(tap(), { deps, log: silent })).resolves.toBe("unlocked");
    expect(deps.sendDirect).toHaveBeenCalledTimes(1);
    expect(deps.recordUnlockedMessage).toHaveBeenCalledWith(DELIVERY, "mid_dm");
    expect(state.status).toBe("unlocked");
  });

  it("no gate status and the DM was not a failed gate message: ignored", async () => {
    const { deps } = setup({}, { followGateStatus: null, dmStatus: "sent" });
    await expect(handleFollowGatePostback(tap(), { deps, log: silent })).resolves.toBe("ignored_not_pending");
    expect(deps.sendDirect).not.toHaveBeenCalled();
  });

  it("not following: re-sends the retry text with the same postback button", async () => {
    const { deps, state } = setup({ isFollowing: vi.fn(async () => false) });
    await expect(handleFollowGatePostback(tap(), { deps, log: silent })).resolves.toBe("not_following");
    expect(deps.sendPostback).toHaveBeenCalledWith("IGTOKEN_fake_123456", OUR, "igsid_1", {
      text: "Not yet alice",
      button: { title: DEFAULT_FOLLOW_GATE_BUTTON_TITLE, payload: `fg:${DELIVERY}` },
    });
    expect(deps.sendDirect).not.toHaveBeenCalled();
    expect(deps.claimUnlock).not.toHaveBeenCalled();
    expect(state.status).toBe("pending");
  });

  it("follow check error: fails open and sends the link", async () => {
    const warn = vi.fn();
    const { deps, state } = setup({
      isFollowing: vi.fn(async () => {
        throw new GraphApiError("Instagram API request timed out IGTOKEN_fake_123456", { status: 0 });
      }),
    });
    await expect(handleFollowGatePostback(tap(), { deps, log: { ...silent, warn } })).resolves.toBe(
      "unlocked_fail_open",
    );
    expect(deps.sendDirect).toHaveBeenCalledTimes(1);
    expect(state.status).toBe("unlocked");
    // The token never reaches the log.
    expect(JSON.stringify(warn.mock.calls)).not.toContain("IGTOKEN_fake_123456");
  });

  it("send failure after claiming reverts to pending so the user can retry", async () => {
    const { deps, state } = setup({
      sendDirect: vi.fn(async () => {
        throw new GraphApiError("(#10) Outside window", { status: 400, code: 10 });
      }),
    });
    await expect(handleFollowGatePostback(tap(), { deps, log: silent })).resolves.toBe("send_failed");
    expect(deps.revertUnlock).toHaveBeenCalledWith(DELIVERY);
    expect(state.status).toBe("pending");
  });

  it("sender mismatch is ignored", async () => {
    const { deps } = setup();
    await expect(
      handleFollowGatePostback(tap({ senderId: "someone_else" }), { deps, log: silent }),
    ).resolves.toBe("ignored_sender_mismatch");
    expect(deps.isFollowing).not.toHaveBeenCalled();
    expect(deps.sendDirect).not.toHaveBeenCalled();
  });

  it("another account's entry or recipient is ignored", async () => {
    const { deps } = setup();
    await expect(handleFollowGatePostback(tap({ igUserId: "other" }), { deps, log: silent })).resolves.toBe(
      "ignored_account_mismatch",
    );
    await expect(
      handleFollowGatePostback(tap({ recipientId: "other" }), { deps, log: silent }),
    ).resolves.toBe("ignored_account_mismatch");
    expect(deps.getDelivery).not.toHaveBeenCalled();
  });

  it("delivery on another account is ignored", async () => {
    const { deps } = setup({}, { igUserId: "other" });
    await expect(handleFollowGatePostback(tap(), { deps, log: silent })).resolves.toBe(
      "ignored_account_mismatch",
    );
  });

  it("deleted rule is ignored", async () => {
    const a = setup({}, { ruleId: null });
    await expect(handleFollowGatePostback(tap(), { deps: a.deps, log: silent })).resolves.toBe(
      "ignored_rule_deleted",
    );
    const b = setup({ getRule: vi.fn(async () => undefined) });
    await expect(handleFollowGatePostback(tap(), { deps: b.deps, log: silent })).resolves.toBe(
      "ignored_rule_deleted",
    );
    expect(b.deps.sendDirect).not.toHaveBeenCalled();
  });

  it("unknown delivery, foreign payload and paused automation are ignored", async () => {
    const a = setup({ getDelivery: vi.fn(async () => undefined) });
    await expect(handleFollowGatePostback(tap(), { deps: a.deps, log: silent })).resolves.toBe(
      "ignored_not_found",
    );
    const b = setup();
    await expect(
      handleFollowGatePostback(tap({ payload: "fg:nope" }), { deps: b.deps, log: silent }),
    ).resolves.toBe("ignored_payload");
    const c = setup({ processingEnabled: vi.fn(async () => false) });
    await expect(handleFollowGatePostback(tap(), { deps: c.deps, log: silent })).resolves.toBe(
      "ignored_disabled",
    );
    expect(c.deps.sendDirect).not.toHaveBeenCalled();
  });

  it("never throws on unexpected errors", async () => {
    const { deps } = setup({
      getDelivery: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    await expect(handleFollowGatePostback(tap(), { deps, log: silent })).resolves.toBe("send_failed");
  });
});
