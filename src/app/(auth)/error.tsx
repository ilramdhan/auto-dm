"use client";

import { RecoverableError } from "@/components/recoverable-error";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-10">
      <RecoverableError error={error} reset={reset} />
    </div>
  );
}
