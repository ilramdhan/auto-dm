import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { Brand } from "@/components/brand";
import { RetryButton } from "./retry-button";

/**
 * Fallback the service worker (public/sw.js) shows when a navigation fails because the device is
 * offline. Precached on install, so it must not depend on the database, the session or env vars.
 */
export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main
      id="main"
      className="pt-safe-16 pb-safe-16 flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center"
    >
      <Brand />
      <div className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full">
        <WifiOff className="size-7" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">You&apos;re offline</h1>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm text-pretty">
          This page needs an internet connection. Check your connection, then try again. Nothing you already
          saved is lost.
        </p>
      </div>
      <RetryButton />
    </main>
  );
}
