"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { skipReasonLabel } from "@/lib/labels";
import { ALL_REASONS, SKIP_REASONS } from "@/lib/validation/skipped";

const DEFAULT = "__default";

export function SkipReasonFilter({ reason }: { reason?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-end gap-3" aria-busy={pending}>
      <div className="grid gap-1.5">
        <Label htmlFor="skipped-reason">Reason</Label>
        <Select
          value={reason ?? DEFAULT}
          onValueChange={(v) =>
            start(() =>
              router.push(v === DEFAULT ? pathname : `${pathname}?reason=${encodeURIComponent(v)}`, {
                scroll: false,
              }),
            )
          }
        >
          <SelectTrigger
            id="skipped-reason"
            className="w-full sm:w-80"
            aria-describedby="skipped-reason-help"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT}>All that can be sent</SelectItem>
            <SelectItem value={ALL_REASONS}>All reasons (incl. own comments)</SelectItem>
            {SKIP_REASONS.map((r) => (
              <SelectItem key={r} value={r}>
                {skipReasonLabel(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span id="skipped-reason-help" className="sr-only">
          Own comments and comments for another account are hidden unless chosen here.
        </span>
      </div>
      {pending ? (
        <span className="text-muted-foreground flex h-9 items-center gap-2 text-sm" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
        </span>
      ) : null}
    </div>
  );
}
