"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok } from "@/lib/action-result";
import { campaignSchema } from "@/lib/validation/campaign";
import { authedAction } from "@/server/actions/safe-action";
import { AppError } from "@/server/errors";
import { getActiveAccount, listMedia, type MediaPage } from "@/server/instagram/account";
import { logger } from "@/server/log";
import { createCampaign, deleteCampaign, setCampaignActive, updateCampaign } from "@/server/repos/campaigns";

const log = logger("campaigns");

function revalidateCampaigns(id?: string) {
  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/campaigns/${id}`);
}

export const createCampaignAction = authedAction("campaigns", "create", campaignSchema, async (data) => {
  const account = await getActiveAccount();
  const row = await createCampaign(data, account?.id ?? null);
  log.info("campaign.created", { campaignId: row.id, target: data.target });
  revalidateCampaigns();
  return ok({ id: row.id });
});

export const updateCampaignAction = authedAction(
  "campaigns",
  "update",
  z.object({ id: z.uuid(), data: campaignSchema }),
  async ({ id, data }) => {
    const row = await updateCampaign(id, data);
    if (!row) throw new AppError("NOT_FOUND", "This campaign no longer exists.");
    revalidateCampaigns(id);
    return ok({ id });
  },
);

export const setCampaignActiveAction = authedAction(
  "campaigns",
  "set_active",
  z.object({ id: z.uuid(), isActive: z.boolean() }),
  async ({ id, isActive }) => {
    if (!(await setCampaignActive(id, isActive)))
      throw new AppError("NOT_FOUND", "This campaign no longer exists.");
    revalidateCampaigns(id);
    return ok({ isActive });
  },
);

export const deleteCampaignAction = authedAction(
  "campaigns",
  "delete",
  z.object({ id: z.uuid() }),
  async ({ id }) => {
    if (!(await deleteCampaign(id))) throw new AppError("NOT_FOUND", "This campaign no longer exists.");
    log.info("campaign.deleted", { campaignId: id });
    revalidateCampaigns();
    return ok();
  },
);

export type MediaPickerResult = { connected: false } | ({ connected: true } & MediaPage);

export const listMediaAction = authedAction(
  "campaigns",
  "list_media",
  z.object({ after: z.string().max(512).nullish() }),
  async ({ after }) => {
    const account = await getActiveAccount();
    if (!account) return ok<MediaPickerResult>({ connected: false });
    try {
      const page = await listMedia({ limit: 24, after: after ?? undefined });
      return ok<MediaPickerResult>({ connected: true, ...page });
    } catch (err) {
      log.warn("media.list_failed", { err });
      return fail(
        "Couldn't load your posts from Instagram. Try again, or reconnect your account in Settings.",
      );
    }
  },
);
