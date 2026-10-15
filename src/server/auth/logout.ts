import "server-only";
import { destroySession, readSession } from "./session";
import { revokeSessions } from "./users";

/**
 * Server-side sign-out shared by `logoutAction` and `POST /api/auth/logout`. Bumping
 * session_version kills this token even if it was copied; single-admin app, so this signs out every
 * device (the safer default). The cookie is cleared even when the revocation fails.
 */
export async function signOutCurrentSession(): Promise<void> {
  try {
    const session = await readSession();
    if (session) await revokeSessions(session.sub);
  } finally {
    await destroySession();
  }
}
