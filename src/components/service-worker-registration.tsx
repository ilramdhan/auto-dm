"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js (offline fallback page only; see the comments there). Production only, so
 * dev never serves stale assets. Renders nothing.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Not fatal: the app works the same without the offline page.
    });
  }, []);
  return null;
}
