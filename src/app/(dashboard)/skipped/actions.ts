"use server";

import { revalidatePath } from "next/cache";
import { ok } from "@/lib/action-result";
import { addCampaignMediaSchema, MAX_CAMPAIGN_MEDIA } from "@/lib/validation/campaign";
import { manualSendSchema, syncMissedSchema } from "@/lib/validation/skipped";
import { authedAction } from "@/server/actions/safe-action";
import { manualSend, syncMissedComments } from "@/server/engine/manual-send";
import { AppError } from "@/server/errors";
import { logger } from "@/server/log";
import { addMediaToCampaign } from "@/server/repos/campaigns";
import { getDelivery } from "@/server/repos/deliveries";

const log = logger("manual");

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

/**
 * "Add this post to campaign" (rows skipped as `no_campaign_for_post`): appends the comment's
 * `media_id` to the campaign's `media_ids` so future comments on that post (e.g. the ad version of
 * a boosted reel) are answered automatically. Idempotent. The row itself stays skipped; the
 * operator can still "Send manually".
 */
export const addPostToCampaignAction = authedAction(
  "manual",
  "add_post_to_campaign",
  addCampaignMediaSchema,
  async ({ campaignId, deliveryId }) => {
    const delivery = await getDelivery(deliveryId);
    if (!delivery) throw new AppError("NOT_FOUND", "This comment no longer exists.");
    if (!delivery.mediaId) throw new AppError("VALIDATION", "This comment has no post id to add.");
    const res = await addMediaToCampaign(campaignId, delivery.mediaId);
    switch (res) {
      case "not_found":
        throw new AppError("NOT_FOUND", "This campaign no longer exists.");
      case "all_posts":
        throw new AppError("CONFLICT", "That campaign already applies to all posts.");
      case "full":
        throw new AppError("CONFLICT", `A campaign can target at most ${MAX_CAMPAIGN_MEDIA} posts.`);
    }
    log.info("campaign.media_added", { campaignId, mediaId: delivery.mediaId, result: res });
    revalidate();
    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${campaignId}`);
    return ok<{ added: boolean }>({ added: res === "added" });
  },
);
