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

/**
 * Mounted once in the root layout:
 * - after a version-skew reload, shows "Updated to a new version";
 * - catches version-skew errors that never reach an error boundary (a Server Action called from an
 *   event handler, a lazily loaded chunk) and reloads once.
 */
export function RecoveryMonitor() {
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
