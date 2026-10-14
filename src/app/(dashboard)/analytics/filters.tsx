"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RangePreset } from "@/lib/validation/analytics";

const ALL = "__all";

export function AnalyticsFilters({
  range,
  from,
  to,
  campaign,
  campaigns,
}: {
  range: RangePreset;
  from: string;
  to: string;
  campaign?: string;
  campaigns: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState({ from, to });
  const [preset, setPreset] = useState<RangePreset>(range);

  function push(update: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(update)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" aria-busy={pending}>
      <div className="grid gap-1.5">
        <Label htmlFor="range">Date range</Label>
        <Select
          value={preset}
          onValueChange={(v) => {
            const p = v as RangePreset;
            setPreset(p);
            if (p !== "custom") push({ range: p, from: undefined, to: undefined });
          }}
        >
          <SelectTrigger id="range" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="custom">Custom range…</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {preset === "custom" ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            push({ range: "custom", from: custom.from, to: custom.to });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              value={custom.from}
              max={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              required
              className="w-40"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="date"
              value={custom.to}
              min={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              required
              className="w-40"
            />
          </div>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </form>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="campaign-filter">Campaign</Label>
        <Select value={campaign ?? ALL} onValueChange={(v) => push({ campaign: v === ALL ? undefined : v })}>
          <SelectTrigger id="campaign-filter" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All campaigns</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {pending ? (
        <span className="text-muted-foreground flex h-9 items-center gap-2 text-sm" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Updating…
        </span>
      ) : null}
    </div>
  );
}
