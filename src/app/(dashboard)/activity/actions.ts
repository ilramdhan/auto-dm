"use server";

import { revalidatePath } from "next/cache";
import { appUrl } from "@/env";
import { ok } from "@/lib/action-result";
import { deleteCommenterDataSchema } from "@/lib/validation/data-deletion";
import { authedAction } from "@/server/actions/safe-action";
import { deleteCommenterData } from "@/server/instagram/data-deletion";
import { logger } from "@/server/log";

const log = logger("data_deletion");

/**
 * Deletes a commenter's stored comment records after they asked by email. `authedAction` calls
 * `requireUser()` first and re-validates the input with the shared schema.
 */
export const deleteCommenterDataAction = authedAction(
  "data_deletion",
  "delete_commenter",
  deleteCommenterDataSchema,
  async (input) => {
    const result = await deleteCommenterData(input);
    // No ids or usernames in logs: only how the request was matched and the outcome.
    log.info("commenter.deleted", {
      by: input.commenterId ? "id" : "username",
      status: result.status,
      deleted: result.deleted,
    });
    revalidatePath("/activity");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
    // Built from APP_URL (not the browser's host) so the link in the reply email is the public one.
    const statusUrl = `${appUrl()}/data-deletion?code=${encodeURIComponent(result.confirmationCode)}`;
    return ok({ ...result, statusUrl });
  },
);
