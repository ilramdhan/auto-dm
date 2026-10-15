import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { requireUser } from "@/server/auth/guard";
import { getActiveAccount } from "@/server/instagram/account";
import { getSettings } from "@/server/settings";

/** Signed-in pages are never indexed (robots.txt also disallows them). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [account, s] = await Promise.all([
    getActiveAccount(),
    getSettings(["processing.enabled", "processing.mode"]),
  ]);
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
