import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { requireUser } from "@/server/auth/guard";
import { getActiveAccount } from "@/server/instagram/account";
import { getSettings } from "@/server/settings";
import { logger } from "@/server/log";
import { serverRegion, timed } from "@/server/diagnostics";

/** Shell data (session + account + status) slower than this is logged as `dashboard.slow_shell`. */
const SLOW_SHELL_MS = 1000;

/** Signed-in pages are never indexed (robots.txt also disallows them). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Cheap visibility for #64: the shell runs on every dashboard navigation, so a slow value here
  // points at database latency (region mismatch or a cold connection), not at the page itself.
  const { result, durationMs } = await timed(async () => {
    const user = await requireUser();
    const [account, s] = await Promise.all([
      getActiveAccount(),
      getSettings(["processing.enabled", "processing.mode"]),
    ]);
    return { user, account, s };
  });
  const { user, account, s } = result;
  if (durationMs >= SLOW_SHELL_MS)
    logger("app").warn("dashboard.slow_shell", { durationMs, region: serverRegion() });
  return (
    <AppShell
      username={user.username}
      status={{
        account: account
          ? { username: account.username, profilePictureUrl: account.profilePictureUrl }
          : null,
        processingEnabled: s["processing.enabled"] ?? true,
        mode: s["processing.mode"] ?? "webhook",
      }}
    >
      {children}
    </AppShell>
  );
}
