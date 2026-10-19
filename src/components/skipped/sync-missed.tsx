"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { syncMissedCommentsAction } from "@/app/(dashboard)/skipped/actions";

const ALL = "__all";

/**
 * "Check post for missed comments": reads the last 7 days of comments of the active post campaigns
 * (or one) from Instagram and lists the ones the app never received. Sends nothing.
 */
export function SyncMissedComments({ campaigns }: { campaigns: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [campaign, setCampaign] = useState(ALL);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  function run() {
    start(async () => {
      setError(null);
      const res = await syncMissedCommentsAction(campaign === ALL ? {} : { campaignId: campaign });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      const r = res.data;
      const parts = [
        `Checked ${r.checked} comment${r.checked === 1 ? "" : "s"} on ${r.posts} post${r.posts === 1 ? "" : "s"}`,
      ];
      if (r.truncated)
        parts.push(
          `${r.truncated} post${r.truncated === 1 ? " has" : "s have"} more comments than were read`,
        );
      if (r.failed) parts.push(`${r.failed} post${r.failed === 1 ? "" : "s"} couldn't be read`);
      const title = r.added
        ? `Found ${r.added} missed comment${r.added === 1 ? "" : "s"}`
        : "No missed comments found";
      (r.failed ? toast.warning : toast.success)(title, { description: parts.join(". ") + "." });
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2 rounded-xl border p-4">
      <div className="grid gap-1">
        <h2 className="text-sm font-medium">Check post for missed comments</h2>
        <p id={`${id}-help`} className="text-muted-foreground text-xs">
          Reads the last 7 days of comments (and replies shown with them) from Instagram and lists any the app
          never received as “Missed”. Nothing is sent automatically.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-campaign`}>Posts to check</Label>
          <Select value={campaign} onValueChange={setCampaign}>
            <SelectTrigger id={`${id}-campaign`} className="w-full sm:w-64" aria-describedby={`${id}-help`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All active post campaigns</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={run}
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCcw aria-hidden />}
          {pending ? "Checking…" : "Check for missed comments"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
