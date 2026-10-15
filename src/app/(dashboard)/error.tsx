"use client";

import { RecoverableError } from "@/components/recoverable-error";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-16">
      <RecoverableError error={error} reset={reset} />
    </div>
  );
}
