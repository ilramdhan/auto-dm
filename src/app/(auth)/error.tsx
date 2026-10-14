"use client";

import { ErrorState } from "@/components/error-state";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-10">
      <ErrorState error={error} reset={reset} />
    </div>
  );
}
