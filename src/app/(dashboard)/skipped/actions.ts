"use server";

import { revalidatePath } from "next/cache";
import { ok } from "@/lib/action-result";
import { manualSendSchema, syncMissedSchema } from "@/lib/validation/skipped";
import { authedAction } from "@/server/actions/safe-action";
import { manualSend, syncMissedComments } from "@/server/engine/manual-send";

function revalidate() {
  revalidatePath("/skipped");
  revalidatePath("/activity");
  revalidatePath("/dashboard");
}

export interface ManualSendOutcome {
  status: "sent" | "partial" | "failed" | "skipped" | "duplicate";
  /** Redacted, short error (same as stored in Activity), when something failed. */
  error: string | null;
  skipReason: string | null;
}

/**
 * Sends a chosen rule's public reply + DM to one skipped comment. `authedAction` runs
 * `requireUser()` first and re-validates the input; refusals come back as `{ ok: false, error }`.
 */
export const manualSendAction = authedAction("manual", "send", manualSendSchema, async (input) => {
  const res = await manualSend(input);
  revalidate();
  return ok<ManualSendOutcome>({ status: res.status, error: res.error, skipReason: res.skipReason });
});

/** "Check post for missed comments": records comments Meta never delivered. Sends nothing. */
export const syncMissedCommentsAction = authedAction("manual", "sync", syncMissedSchema, async (input) => {
  const res = await syncMissedComments(input);
  revalidate();
  return ok(res);
});
