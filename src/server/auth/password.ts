import "server-only";
import { hash, verify } from "@node-rs/argon2";

/** OWASP-recommended argon2id parameters (19 MiB, t=2, p=1). @node-rs/argon2 defaults to argon2id. */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;
/**
 * Burn roughly the same CPU time as a real verification when the user doesn't exist, so response
 * timing doesn't reveal which usernames exist.
 */
export async function verifyDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("dummy-password-for-timing-equalization");
  await verifyPassword(await dummyHash, password);
  return false;
}
