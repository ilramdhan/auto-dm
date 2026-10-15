"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isVersionSkewError } from "@/lib/error-recovery";

export function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const skew = isVersionSkewError(error);
  // reset() alone re-renders with the cached (failed) server payload; refresh fetches it again.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
      <div className="bg-destructive/10 text-destructive flex size-14 items-center justify-center rounded-full">
        <AlertTriangle className="size-7" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          {skew ? "A new version is available" : "Something went wrong"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {skew
            ? "AutoDM was updated while this page was open. Reload the page to continue."
            : "An unexpected error occurred while loading this page. You can try again; if it keeps happening, check the server logs."}
        </p>
        {error.digest ? (
          <p className="text-muted-foreground font-mono text-xs">Reference: {error.digest}</p>
        ) : null}
      </div>
      {skew ? (
        <Button onClick={() => window.location.reload()}>
          <RefreshCw aria-hidden />
          Reload page
        </Button>
      ) : (
        <Button onClick={retry}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
      )}
    </div>
  );
}
