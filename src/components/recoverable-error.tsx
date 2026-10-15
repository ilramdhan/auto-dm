"use client";

import { Loader2 } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { useErrorRecovery } from "@/components/error-recovery";

/**
 * Error boundary body: tries to recover by itself first (see `useErrorRecovery`) and only shows the
 * error card when that is not possible.
 */
export function RecoverableError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const phase = useErrorRecovery(error, reset);
  if (phase === "show") return <ErrorState error={error} reset={reset} />;
  return (
    <div
      role="status"
      aria-live="polite"
      className="text-muted-foreground mx-auto flex max-w-md items-center justify-center gap-2 text-sm"
    >
      <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
      {phase === "reloading" ? "Loading the new version…" : "Loading…"}
    </div>
  );
}
