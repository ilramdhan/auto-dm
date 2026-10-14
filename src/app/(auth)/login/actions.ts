"use server";

import { redirect } from "next/navigation";
import { fail, fromZodError, type ActionResult } from "@/lib/action-result";
import { loginSchema } from "@/lib/validation/auth";
import { clearFailures, clientIp, isRateLimited, recordFailure } from "@/server/auth/rate-limit";
import { createSession, destroySession } from "@/server/auth/session";
import { authenticate, touchLastLogin } from "@/server/auth/users";

const GENERIC = "Incorrect username or password.";

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const { username, password, next } = parsed.data;

  const ip = await clientIp();
  if (await isRateLimited(ip, username)) {
    return fail("Too many failed attempts. Please wait 15 minutes and try again.");
  }

  const user = await authenticate(username, password);
  if (!user) {
    await recordFailure(ip, username);
    return fail(GENERIC);
  }

  await clearFailures(ip, username);
  await touchLastLogin(user.id);
  await createSession(user.id, user.sessionVersion);
  redirect(user.mustChangePassword ? "/change-password" : safeNext(next));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
