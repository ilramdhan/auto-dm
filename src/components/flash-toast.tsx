"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export type Flash = { type: "success" | "error" | "info" | "warning"; message: string; description?: string };

/**
 * Shows server-computed one-off messages (e.g. after an OAuth redirect) as toasts, then strips the
 * given query params so a reload doesn't repeat them.
 */
export function FlashToast({ flashes, clearParams }: { flashes: Flash[]; clearParams: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current || flashes.length === 0) return;
    shown.current = true;
    for (const f of flashes) toast[f.type](f.message, { description: f.description });
    const next = new URLSearchParams(params.toString());
    clearParams.forEach((p) => next.delete(p));
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [flashes, clearParams, params, pathname, router]);

  return null;
}
