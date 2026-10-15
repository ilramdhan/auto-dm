"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  decideRecovery,
  isVersionSkewError,
  parseTimestamp,
  RELOAD_GUARD_MS,
  canAttempt,
  STORAGE_KEYS,
  type RecoveryAction,
} from "@/lib/error-recovery";
import {
  clientNavigationTarget,
  isOutdatedBuild,
  NAVIGATION_WATCHDOG_MS,
  navigationKey,
  parseVersionResponse,
  shouldCheckVersion,
  VERSION_ENDPOINT,
  VERSION_POLL_INTERVAL_MS,
} from "@/lib/app-update";

/** sessionStorage can be unavailable (privacy mode, blocked storage): every access is guarded. */
function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Without storage the guard cannot persist; `reloadForNewVersion` refuses to reload in that case.
  }
}
function remove(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Full page load to pick up the new deployment. Returns false (and does nothing) when it already
 * happened within the guard window, or when the guard cannot be stored (would risk a reload loop).
 */
export function reloadForNewVersion(): boolean {
  const now = Date.now();
  if (!canAttempt(parseTimestamp(read(STORAGE_KEYS.reloadAt)), now, RELOAD_GUARD_MS)) return false;
  write(STORAGE_KEYS.reloadAt, String(now));
  if (read(STORAGE_KEYS.reloadAt) !== String(now)) return false;
  write(STORAGE_KEYS.updated, "1");
  window.location.reload();
  return true;
}

export type RecoveryPhase = "pending" | "reloading" | "retrying" | "show";

/** Runs the recovery side effect for `error` (reload or retry) and returns the phase to render. */
function decide(error: unknown, reset: () => void, refresh: () => void): RecoveryPhase {
  const now = Date.now();
  const retryKey = STORAGE_KEYS.retryAt(window.location.pathname);
  const action: RecoveryAction = decideRecovery({
    error,
    now,
    lastReloadAt: parseTimestamp(read(STORAGE_KEYS.reloadAt)),
    lastRetryAt: parseTimestamp(read(retryKey)),
  });
  if (action === "reload" && reloadForNewVersion()) return "reloading";
  if (action !== "show") {
    write(retryKey, String(now));
    // Without a stored guard a failing retry could loop: show the card instead.
    if (read(retryKey) === String(now)) {
      startTransition(() => {
        refresh();
        reset();
      });
      return "retrying";
    }
  }
  console.error(error);
  return "show";
}

/**
 * For error boundaries: on a version-skew error reload the page once; on any other error re-render
 * the segment once with fresh server data (router.refresh + reset). Only when that already happened
 * recently (guards in sessionStorage) is the error card shown, so a persistent error never loops.
 */
export function useErrorRecovery(error: unknown, reset: () => void): RecoveryPhase {
  const router = useRouter();
  const [phase, setPhase] = useState<RecoveryPhase>("pending");
  // Decided once per error object: StrictMode re-runs effects, and a retry that fails again renders
  // this component with a new error (whose guard then says "show").
  const decision = useRef<{ error: unknown; phase: RecoveryPhase } | null>(null);

  useEffect(() => {
    let current = decision.current;
    if (!current || current.error !== error) {
      current = { error, phase: decide(error, reset, () => router.refresh()) };
      decision.current = current;
    }
    const next = current.phase;
    // Deferred: state updates belong in a callback, not the effect body.
    const id = window.setTimeout(() => setPhase(next), 0);
    return () => window.clearTimeout(id);
  }, [error, reset, router]);

  return phase;
}

const CLIENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID;
const VERSION_FETCH_TIMEOUT_MS = 5000;
const STUCK_TOAST_ID = "autodm-navigation-stuck";

/** Build id the server is running, or null when unknown (offline, timeout, unexpected body). */
async function fetchServerBuildId(): Promise<string | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), VERSION_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(VERSION_ENDPOINT, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return parseVersionResponse(await res.json())?.buildId ?? null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function offerReload(title: string, description: string): void {
  toast.warning(title, {
    id: STUCK_TOAST_ID,
    description,
    duration: Number.POSITIVE_INFINITY,
    action: { label: "Reload", onClick: () => window.location.reload() },
  });
}

/**
 * Compares this bundle's build id with the server's. On a mismatch reloads once (loop-guarded);
 * returns true when the build is outdated (whether or not the reload happened).
 */
async function checkForNewVersion(): Promise<boolean> {
  const serverBuildId = await fetchServerBuildId();
  if (!isOutdatedBuild(CLIENT_BUILD_ID, serverBuildId)) return false;
  if (!reloadForNewVersion()) {
    // Reloaded recently and still outdated (e.g. a cached page): let the user decide.
    offerReload("A new version of AutoDM is available", "Reload to finish updating.");
  }
  return true;
}

/**
 * Installed PWAs (and long-lived tabs) resume the old page from memory after a deploy, so the old
 * bundle keeps talking to the new server (#87). Checks the server's build id when the app becomes
 * visible again (throttled) and periodically while it stays visible.
 */
function useVersionCheck(): void {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !CLIENT_BUILD_ID) return;
    // A fresh page load is current by definition: the first check waits for the throttle window.
    let lastCheckAt: number | null = Date.now();
    let inFlight = false;

    const check = (force = false) => {
      if (document.visibilityState !== "visible" || inFlight) return;
      const now = Date.now();
      if (!force && !shouldCheckVersion(lastCheckAt, now)) return;
      lastCheckAt = now;
      inFlight = true;
      void checkForNewVersion().finally(() => {
        inFlight = false;
      });
    };
    const onVisible = () => check();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) check();
    };
    const interval = window.setInterval(() => check(true), VERSION_POLL_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
}

/**
 * True while a navigation started at `fromKey` has not finished: the URL has not changed yet (not
 * committed) or a route's loading.tsx skeleton (marked `data-route-loading`) is still on screen.
 * `fromKey` null (back/forward, where the URL changes first) checks only the skeleton. Comparing
 * with the starting URL rather than the link target keeps redirects from counting as stuck.
 */
function navigationPending(fromKey: string | null): boolean {
  if (fromKey !== null && navigationKey(new URL(window.location.href)) === fromKey) return true;
  return document.querySelector("[data-route-loading]") !== null;
}

/**
 * A client navigation of a stale bundle can hang forever on the loading skeleton (#87). If one has
 * not finished after NAVIGATION_WATCHDOG_MS: reload once when the server runs a newer build,
 * otherwise offer a "Reload" toast (dismissed again if the page finishes loading after all).
 */
function useNavigationWatchdog(): void {
  useEffect(() => {
    let timer: number | undefined;
    let generation = 0;

    const schedule = (fn: () => void, ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(fn, ms);
    };
    const arm = (fromKey: string | null) => {
      const current = ++generation;
      schedule(() => void inspect(fromKey, current), NAVIGATION_WATCHDOG_MS);
    };
    // After the toast: dismiss it once the navigation finishes on its own.
    const settle = (fromKey: string | null, current: number) => {
      if (current !== generation) return;
      if (!navigationPending(fromKey)) toast.dismiss(STUCK_TOAST_ID);
      else schedule(() => settle(fromKey, current), 1000);
    };
    const inspect = async (fromKey: string | null, current: number) => {
      if (current !== generation) return;
      // Background tabs may pause the network: look again once the user can see the result.
      if (document.visibilityState !== "visible") {
        schedule(() => void inspect(fromKey, current), NAVIGATION_WATCHDOG_MS);
        return;
      }
      if (!navigationPending(fromKey)) return;
      if (process.env.NODE_ENV === "production" && CLIENT_BUILD_ID && (await checkForNewVersion())) return;
      if (current !== generation || !navigationPending(fromKey)) return;
      offerReload(
        "This page is taking too long to load",
        "Reloading usually fixes it, especially right after AutoDM was updated.",
      );
      settle(fromKey, current);
    };

    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const target = clientNavigationTarget({
        href: anchor.href,
        currentHref: window.location.href,
        button: event.button,
        modifierKey: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
        target: anchor.getAttribute("target"),
        download: anchor.hasAttribute("download"),
      });
      if (target) arm(navigationKey(new URL(window.location.href)));
    };
    // Back/forward: the URL has already changed, so only the skeleton check applies.
    const onPopState = () => arm(null);

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);
}

/**
 * Mounted once in the root layout:
 * - after a version-skew reload, shows "Updated to a new version";
 * - catches version-skew errors that never reach an error boundary (a Server Action called from an
 *   event handler, a lazily loaded chunk) and reloads once;
 * - checks the server's build id when the app returns to the foreground and every few minutes, and
 *   reloads once when a new version was deployed (#87);
 * - watches client navigations and offers a reload when one hangs (#87).
 */
export function RecoveryMonitor() {
  useVersionCheck();
  useNavigationWatchdog();
  useEffect(() => {
    if (read(STORAGE_KEYS.updated)) {
      remove(STORAGE_KEYS.updated);
      toast.info("Updated to a new version", {
        description: "AutoDM was updated while this tab was open, so the page was reloaded.",
      });
    }
    const onError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const err = "reason" in event ? event.reason : (event.error ?? event.message);
      if (isVersionSkewError(err)) reloadForNewVersion();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onError);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onError);
    };
  }, []);
  return null;
}
