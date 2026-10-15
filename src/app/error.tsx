"use client";

import { RecoverableError } from "@/components/recoverable-error";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-16">
      <RecoverableError error={error} reset={reset} />
    </main>
  );
}
