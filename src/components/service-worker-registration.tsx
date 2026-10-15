"use client";

import { useEffect } from "react";
import { reloadForNewVersion } from "@/components/error-recovery";

/**
 * Registers public/sw.js (offline fallback page only; see the comments there). Production only, so
 * dev never serves stale assets. Renders nothing.
 *
 * After a deploy (#87):
 * - asks the browser to look for a new sw.js whenever the app returns to the foreground (installed
 *   apps are rarely reloaded, so the browser's own update check may not run for a long time);
 * - when a new worker takes control of a page that already had one, reloads once (same loop guard
 *   as the version-skew reload) so the page and the worker come from the same deployment.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    // A first install also fires controllerchange (clients.claim): only an update should reload.
    const hadController = sw.controller !== null;
    let registration: ServiceWorkerRegistration | null = null;

    sw.register("/sw.js", { scope: "/" })
      .then((reg) => {
        registration = reg;
      })
      .catch(() => {
        // Not fatal: the app works the same without the offline page.
      });

    const onControllerChange = () => {
      if (hadController) reloadForNewVersion();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !registration) return;
      registration.update().catch(() => {
        // Offline or the request failed: the next return to the foreground tries again.
      });
    };

    sw.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sw.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
