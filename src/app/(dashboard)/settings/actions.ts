"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok } from "@/lib/action-result";
import { changePasswordSchema, changeUsernameSchema } from "@/lib/validation/auth";
import {
  apiKeyNameSchema,
  metaAppSchema,
  processingSchema,
  publicContactSchema,
  timeZoneSchema,
} from "@/lib/validation/settings";
import { authedAction } from "@/server/actions/safe-action";
import { createApiKey, revokeApiKey } from "@/server/api-keys";
import { verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { getUserById, updatePassword, updateUsername } from "@/server/auth/users";
import { randomToken } from "@/server/crypto";
import { AppError } from "@/server/errors";
import { disconnectAccount } from "@/server/instagram/account";
import { logger } from "@/server/log";
import { ensureVerifyToken, setSetting } from "@/server/settings";

const log = logger("settings");
const authLog = logger("auth");

async function checkCurrentPassword(userId: string, current: string): Promise<boolean> {
  const user = await getUserById(userId);
  return !!user && (await verifyPassword(user.passwordHash, current));
}

/* --------------------------------- account -------------------------------- */

export const changeUsernameAction = authedAction(
  "settings",
  "change_username",
  changeUsernameSchema,
  async (input, user) => {
    if (!(await checkCurrentPassword(user.id, input.current))) {
      authLog.warn("username_change.bad_password", { userId: user.id });
      return fail("Please fix the highlighted fields.", { current: ["Current password is incorrect"] });
    }
    if ((await updateUsername(user.id, input.username)) === "taken") {
      return fail("Please fix the highlighted fields.", { username: ["That username is taken"] });
    }
    authLog.info("username.changed", { userId: user.id });
    revalidatePath("/", "layout");
    return ok({ username: input.username });
  },
);

export const changePasswordAction = authedAction(
  "settings",
  "change_password",
  changePasswordSchema,
  async (input, user) => {
    if (!(await checkCurrentPassword(user.id, input.current))) {
      authLog.warn("password_change.bad_password", { userId: user.id });
      return fail("Please fix the highlighted fields.", { current: ["Current password is incorrect"] });
    }
    const { sessionVersion } = await updatePassword(user.id, input.password);
    await createSession(user.id, sessionVersion);
    authLog.info("password.changed", { userId: user.id, forced: false });
    return ok();
  },
);

export const savePublicContactAction = authedAction(
  "settings",
  "save_public_contact",
  publicContactSchema,
  async ({ operatorName, contactEmail }) => {
    await setSetting("general.operatorName", operatorName);
    await setSetting("general.contactEmail", contactEmail);
    log.info("public_contact.saved", {});
    revalidatePath("/settings");
    revalidatePath("/privacy");
    revalidatePath("/data-deletion");
    return ok();
  },
);

/* -------------------------------- instagram ------------------------------- */

export const saveMetaAppAction = authedAction(
  "settings",
  "save_meta_app",
  metaAppSchema,
  async ({ appId, appSecret }) => {
    await setSetting("meta.appId", appId);
    if (appSecret) await setSetting("meta.appSecret", appSecret);
    log.info("meta_app.saved", { secretUpdated: !!appSecret });
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return ok();
  },
);

/** Returns the webhook verify token (created on first use) for the copy/reveal UI. */
export const revealVerifyTokenAction = authedAction(
  "settings",
  "reveal_verify_token",
  z.object({}),
  async () => {
    return ok({ token: await ensureVerifyToken() });
  },
);

export const regenerateVerifyTokenAction = authedAction(
  "settings",
  "regenerate_verify_token",
  z.object({}),
  async () => {
    const token = randomToken(24);
    await setSetting("webhook.verifyToken", token);
    log.info("verify_token.regenerated", {});
    return ok({ token });
  },
);

export const disconnectInstagramAction = authedAction(
  "settings",
  "disconnect_instagram",
  z.object({}),
  async () => {
    await disconnectAccount();
    log.info("instagram.disconnected", {});
    revalidatePath("/", "layout");
    return ok();
  },
);

/* ------------------------------- processing ------------------------------- */

export const saveProcessingAction = authedAction(
  "settings",
  "save_processing",
  processingSchema,
  async ({ mode, enabled }) => {
    await setSetting("processing.mode", mode);
    await setSetting("processing.enabled", enabled);
    log.info("processing.saved", { mode, enabled });
    revalidatePath("/", "layout");
    return ok();
  },
);

/* ---------------------------------- n8n ----------------------------------- */

export const createApiKeyAction = authedAction(
  "settings",
  "create_api_key",
  apiKeyNameSchema,
  async ({ name }) => {
    const { id, key } = await createApiKey(name);
    log.info("api_key.created", { apiKeyId: id });
    revalidatePath("/settings");
    return ok({ id, key });
  },
);

export const revokeApiKeyAction = authedAction(
  "settings",
  "revoke_api_key",
  z.object({ id: z.uuid() }),
  async ({ id }) => {
    if (!(await revokeApiKey(id)))
      throw new AppError("NOT_FOUND", "This key doesn't exist or was already revoked.");
    log.info("api_key.revoked", { apiKeyId: id });
    revalidatePath("/settings");
    return ok();
  },
);

/* -------------------------------- time zone ------------------------------- */

export const saveTimeZoneAction = authedAction(
  "settings",
  "save_timezone",
  timeZoneSchema,
  async ({ timeZone }) => {
    await setSetting("general.timezone", timeZone);
    log.info("timezone.saved", { timeZone });
    revalidatePath("/", "layout");
    return ok();
  },
);
