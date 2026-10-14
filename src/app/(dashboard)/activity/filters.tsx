"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DELIVERY_STATUSES } from "@/lib/validation/activity";
import { DELIVERY_STATUS_META } from "@/components/delivery-status-badge";

const ALL = "__all";

export function ActivityFilters({
  status,
  campaign,
  q,
  campaigns,
}: {
  status?: string;
  campaign?: string;
  q?: string;
  campaigns: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(q ?? "");

  function push(update: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(update)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const hasFilters = !!(status || campaign || q);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end" aria-busy={pending}>
      <form
        role="search"
        className="grid flex-1 gap-1.5 md:max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: search.trim() || undefined });
        }}
      >
        <Label htmlFor="activity-q">Search</Label>
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            id="activity-q"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Username, comment or keyword"
            className="pl-8"
            aria-describedby="activity-q-help"
          />
        </div>
        <span id="activity-q-help" className="sr-only">
          Press Enter to search
        </span>
      </form>
      <div className="grid grid-cols-2 gap-3 md:flex">
        <div className="grid gap-1.5">
          <Label htmlFor="activity-status">Status</Label>
          <Select value={status ?? ALL} onValueChange={(v) => push({ status: v === ALL ? undefined : v })}>
            <SelectTrigger id="activity-status" className="w-full md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {DELIVERY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {DELIVERY_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="activity-campaign">Campaign</Label>
          <Select
            value={campaign ?? ALL}
            onValueChange={(v) => push({ campaign: v === ALL ? undefined : v })}
          >
            <SelectTrigger id="activity-campaign" className="w-full md:w-52">
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
      </div>
      {hasFilters ? (
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            startTransition(() => router.push(pathname));
          }}
        >
          <X aria-hidden /> Clear filters
        </Button>
      ) : null}
      {pending ? (
        <span className="text-muted-foreground flex h-9 items-center gap-2 text-sm" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
        </span>
      ) : null}
    </div>
  );
}
