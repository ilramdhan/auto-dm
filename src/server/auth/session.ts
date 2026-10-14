import "server-only";
import { cookies } from "next/headers";
import { deriveKey } from "@/server/crypto";
import { env } from "@/env";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSessionToken,
  verifySessionToken,
  type SessionClaims,
} from "./session-token";

function sessionKey(): Uint8Array {
  return new Uint8Array(deriveKey("session"));
}

export async function createSession(userId: string, sessionVersion: number): Promise<void> {
  const token = await signSessionToken({ sub: userId, ver: sessionVersion }, sessionKey());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function readSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token, sessionKey());
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
