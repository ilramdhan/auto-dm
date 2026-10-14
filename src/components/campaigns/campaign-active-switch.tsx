"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setCampaignActiveAction } from "@/app/(dashboard)/campaigns/actions";

/** Optimistic on/off switch for a campaign. */
export function CampaignActiveSwitch({
  id,
  name,
  isActive,
  showLabel = false,
}: {
  id: string;
  name: string;
  isActive: boolean;
  showLabel?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(isActive);
  const switchId = `campaign-active-${id}`;

  function onChange(next: boolean) {
    startTransition(async () => {
      setOptimistic(next);
      const res = await setCampaignActiveAction({ id, isActive: next });
      if (res.ok) {
        toast.success(next ? `“${name}” is active` : `“${name}” paused`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        id={switchId}
        checked={optimistic}
        onCheckedChange={onChange}
        disabled={pending}
        aria-label={showLabel ? undefined : `${optimistic ? "Pause" : "Activate"} campaign ${name}`}
      />
      {showLabel ? (
        <Label htmlFor={switchId} className="text-sm">
          {optimistic ? "Active" : "Paused"}
        </Label>
      ) : null}
    </div>
  );
}
