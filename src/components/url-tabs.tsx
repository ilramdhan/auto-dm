"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";

/** Radix Tabs whose active tab is mirrored in `?tab=` (shareable, survives reloads). */
export function UrlTabs({
  defaultValue,
  values,
  children,
  className,
}: {
  defaultValue: string;
  values: readonly string[];
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("tab");
  const value = current && values.includes(current) ? current : defaultValue;
  const root = useRef<HTMLDivElement>(null);
  // On narrow screens the tab strip scrolls sideways; keep the active tab visible (e.g. ?tab=about).
  useEffect(() => {
    const active = root.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);
  return (
    <Tabs
      ref={root}
      value={value}
      className={className}
      onValueChange={(v) => {
        const next = new URLSearchParams(params.toString());
        if (v === defaultValue) next.delete("tab");
        else next.set("tab", v);
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
    >
      {children}
    </Tabs>
  );
}
