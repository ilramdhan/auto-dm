import "server-only";
import { count, eq, sql } from "drizzle-orm";
import { env } from "@/env";
import { safeEqual } from "@/server/crypto";
import { db } from "@/server/db/client";
import { users, type User } from "@/server/db/schema";
import { hashPassword, verifyDummy, verifyPassword } from "./password";

export async function findUserByUsername(username: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.username})`, username.trim().toLowerCase()))
    .limit(1);
  return user;
}

export async function hasAnyUser(): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(users);
  return (row?.n ?? 0) > 0;
}

/**
 * First-run bootstrap: while the users table is empty, logging in with
 * ADMIN_DEFAULT_USERNAME / ADMIN_DEFAULT_PASSWORD creates the admin (forced to change the password).
 */
async function bootstrapAdmin(username: string, password: string): Promise<User | null> {
  const { ADMIN_DEFAULT_USERNAME, ADMIN_DEFAULT_PASSWORD } = env();
  const userOk = safeEqual(username.trim().toLowerCase(), ADMIN_DEFAULT_USERNAME.toLowerCase());
  const passOk = safeEqual(password, ADMIN_DEFAULT_PASSWORD);
  if (!userOk || !passOk) return null;
  await db
    .insert(users)
    .values({
      username: ADMIN_DEFAULT_USERNAME,
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    })
    .onConflictDoNothing();
  return (await findUserByUsername(ADMIN_DEFAULT_USERNAME)) ?? null;
}

/** Returns the user on valid credentials, otherwise null. Timing is roughly constant either way. */
export async function authenticate(username: string, password: string): Promise<User | null> {
  const user = await findUserByUsername(username);
  if (!user) {
    if (!(await hasAnyUser())) {
      const created = await bootstrapAdmin(username, password);
      if (created) return created;
    }
    await verifyDummy(password);
    return null;
  }
  return (await verifyPassword(user.passwordHash, password)) ? user : null;
}

export function isDefaultPassword(password: string): boolean {
  return safeEqual(password, env().ADMIN_DEFAULT_PASSWORD);
}

/** Sets a new password, clears the first-run flag and invalidates all other sessions. */
export async function updatePassword(userId: string, password: string): Promise<{ sessionVersion: number }> {
  const [row] = await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, userId))
    .returning({ sessionVersion: users.sessionVersion });
  if (!row) throw new Error("User not found");
  return row;
}

/** Invalidates every issued session token for the user (used on sign-out). */
export async function revokeSessions(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId));
}

export async function getUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export async function updateUsername(userId: string, username: string): Promise<"ok" | "taken"> {
  const existing = await findUserByUsername(username);
  if (existing && existing.id !== userId) return "taken";
  await db.update(users).set({ username }).where(eq(users.id, userId));
  return "ok";
}

export async function touchLastLogin(userId: string): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}
