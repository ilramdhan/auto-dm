"use client";

import { useEffect, useState } from "react";
import {
  canAttempt,
  isVersionSkewError,
  parseTimestamp,
  RELOAD_GUARD_MS,
  RETRY_GUARD_MS,
  STORAGE_KEYS,
} from "@/lib/error-recovery";

/**
 * Reloads the page once (guarded in sessionStorage) instead of showing the card straight away: the
 * root layout failed, so a full load is the only retry, and it also picks up a new deployment.
 * Returns false when it already did so recently or storage is unavailable (no reload loops).
 */
function reloadOnce(error: unknown): boolean {
  try {
    const skew = isVersionSkewError(error);
    const key = skew ? STORAGE_KEYS.reloadAt : STORAGE_KEYS.retryAt(window.location.pathname);
    const now = Date.now();
    if (
      !canAttempt(parseTimestamp(sessionStorage.getItem(key)), now, skew ? RELOAD_GUARD_MS : RETRY_GUARD_MS)
    )
      return false;
    sessionStorage.setItem(key, String(now));
    if (sessionStorage.getItem(key) !== String(now)) return false;
    if (skew) sessionStorage.setItem(STORAGE_KEYS.updated, "1");
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

/** Last-resort boundary (root layout failed). Must render its own <html>/<body>; no providers available. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (reloadOnce(error)) return;
    console.error(error);
    // Deferred: state updates belong in a callback, not the effect body.
    const id = window.setTimeout(() => setShow(true), 0);
    return () => window.clearTimeout(id);
  }, [error]);

  if (!show) {
    return (
      <html lang="en">
        <body style={{ margin: 0, background: "#fcfcfd" }}>
          <p role="status" style={{ position: "absolute", left: -9999 }}>
            Loading…
          </p>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#fcfcfd",
          color: "#18181b",
          padding: 16,
        }}
      >
        <main role="alert" style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#52525b", fontSize: 14, lineHeight: 1.5 }}>
            The app failed to load. Try again; if it keeps happening, check the server logs.
          </p>
          {error.digest ? (
            <p style={{ color: "#52525b", fontSize: 12, fontFamily: "monospace" }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            onClick={() => (isVersionSkewError(error) ? window.location.reload() : reset())}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              borderRadius: 8,
              border: 0,
              background: "#5b21b6",
              color: "white",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
