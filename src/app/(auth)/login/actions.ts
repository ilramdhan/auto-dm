"use server";

import { redirect } from "next/navigation";
import { fail, zodFailure, type ActionResult } from "@/lib/action-result";
import { runAction } from "@/server/actions/safe-action";
import { logger } from "@/server/log";
import { loginSchema } from "@/lib/validation/auth";
import { clearFailures, clientIp, isRateLimited, recordFailure } from "@/server/auth/rate-limit";
import { createSession, destroySession, readSession } from "@/server/auth/session";
import { authenticate, revokeSessions, touchLastLogin } from "@/server/auth/users";

const GENERIC = "Incorrect username or password.";
const log = logger("auth");

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/dashboard";
}

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction("auth", "login", async () => {
    const parsed = loginSchema.safeParse({
      username: formData.get("username"),
      password: formData.get("password"),
      next: formData.get("next") ?? undefined,
    });
    if (!parsed.success) return zodFailure(parsed.error);
    const { username, password, next } = parsed.data;

    const ip = await clientIp();
    if (await isRateLimited(ip, username)) {
      log.warn("login.locked_out", { ip, username });
      return fail("Too many failed attempts. Please wait 15 minutes and try again.");
    }

    const user = await authenticate(username, password);
    if (!user) {
      await recordFailure(ip, username);
      log.warn("login.failed", { ip, username });
      return fail(GENERIC);
    }

    await clearFailures(ip, username);
    await touchLastLogin(user.id);
    await createSession(user.id, user.sessionVersion);
    log.info("login.succeeded", { ip, userId: user.id, mustChangePassword: user.mustChangePassword });
    redirect(user.mustChangePassword ? "/change-password" : safeNext(next));
  });
}

export async function logoutAction(): Promise<void> {
  // Server-side revocation: bumping session_version kills this token even if it was copied.
  // Single-admin app, so this signs out every device - the safer default.
  const session = await readSession();
  if (session) await revokeSessions(session.sub);
  await destroySession();
  log.info("logout", {});
  redirect("/login");
}
