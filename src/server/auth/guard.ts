import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, withDbRetry } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { readSession } from "./session";

export type SessionUser = {
  id: string;
  username: string;
  mustChangePassword: boolean;
  sessionVersion: number;
};

/**
 * Validates the session cookie against the DB (user exists, session_version matches).
 * Returns null when unauthenticated. Memoized per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const claims = await readSession();
  if (!claims) return null;
  // First query of almost every request: retried once if the pooled connection went stale.
  const [user] = await withDbRetry(
    () =>
      db
        .select({
          id: users.id,
          username: users.username,
          mustChangePassword: users.mustChangePassword,
          sessionVersion: users.sessionVersion,
        })
        .from(users)
        .where(eq(users.id, claims.sub))
        .limit(1),
    { label: "auth.currentUser" },
  );
  if (!user || user.sessionVersion !== claims.ver) return null;
  return user;
});

/**
 * Use at the top of every dashboard page, server action and admin route handler.
 * Redirects to /login when signed out and to /change-password while the first-run password is in use.
 */
export async function requireUser(): Promise<{ id: string; username: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return { id: user.id, username: user.username };
}

/** Like requireUser but allows users that still must change their password (for /change-password). */
export async function requireSession(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
