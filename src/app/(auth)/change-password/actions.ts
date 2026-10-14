"use server";

import { redirect } from "next/navigation";
import { fail, zodFailure, type ActionResult } from "@/lib/action-result";
import { runAction } from "@/server/actions/safe-action";
import { logger } from "@/server/log";
import { forcedChangePasswordSchema } from "@/lib/validation/auth";
import { requireSession } from "@/server/auth/guard";
import { createSession } from "@/server/auth/session";
import { isDefaultPassword, updatePassword } from "@/server/auth/users";

export async function forcedChangePasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSession();
  if (!user.mustChangePassword) redirect("/settings?tab=account");
  return runAction("auth", "forced_password_change", async () => {
    const parsed = forcedChangePasswordSchema.safeParse({
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });
    if (!parsed.success) return zodFailure(parsed.error);
    if (isDefaultPassword(parsed.data.password)) {
      return fail("Please fix the highlighted fields.", {
        password: ["Choose something other than the default password"],
      });
    }
    const { sessionVersion } = await updatePassword(user.id, parsed.data.password);
    await createSession(user.id, sessionVersion);
    logger("auth").info("password.changed", { userId: user.id, forced: true });
    redirect("/dashboard?welcome=1");
  });
}
