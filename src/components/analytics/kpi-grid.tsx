import {
  AlertTriangle,
  Clock,
  Filter,
  MessageCircle,
  MessageSquareReply,
  MinusCircle,
  Send,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pct } from "@/lib/validation/analytics";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type KpiData = {
  comments: number;
  matched: number;
  repliesSent: number;
  repliesFailed: number;
  dmsSent: number;
  dmsFailed: number;
  failed: number;
  partial: number;
  skipped: number;
  avgDurationMs: number | null;
};

function rate(v: number | null): string {
  return v === null ? "—" : `${v}%`;
}

export function KpiGrid({ k, className }: { k: KpiData; className?: string }) {
  const items: { label: string; value: string; sub: string; icon: LucideIcon; tone: string }[] = [
    {
      label: "Comments received",
      value: formatNumber(k.comments),
      sub: "All comments on tracked accounts",
      icon: MessageCircle,
      tone: "text-primary bg-primary/10",
    },
    {
      label: "Keyword matches",
      value: formatNumber(k.matched),
      sub: `Match rate ${rate(pct(k.matched, k.comments))}`,
      icon: Filter,
      tone: "text-info bg-info/10",
    },
    {
      label: "Public replies sent",
      value: formatNumber(k.repliesSent),
      sub: `Success ${rate(pct(k.repliesSent, k.repliesSent + k.repliesFailed))} · ${formatNumber(k.repliesFailed)} failed`,
      icon: MessageSquareReply,
      tone: "text-success bg-success/10",
    },
    {
      label: "DMs sent",
      value: formatNumber(k.dmsSent),
      sub: `Success ${rate(pct(k.dmsSent, k.dmsSent + k.dmsFailed))} · ${formatNumber(k.dmsFailed)} failed`,
      icon: Send,
      tone: "text-success bg-success/10",
    },
    {
      label: "Failed",
      value: formatNumber(k.failed),
      sub: `${formatNumber(k.partial)} partially delivered`,
      icon: AlertTriangle,
      tone: "text-destructive bg-destructive/10",
    },
    {
      label: "Skipped",
      value: formatNumber(k.skipped),
      sub: "No match, duplicate or paused",
      icon: MinusCircle,
      tone: "text-muted-foreground bg-muted",
    },
    {
      label: "Avg. processing time",
      value:
        k.avgDurationMs === null
          ? "—"
          : k.avgDurationMs >= 1000
            ? `${(k.avgDurationMs / 1000).toFixed(1)} s`
            : `${k.avgDurationMs} ms`,
      sub: "From webhook to last action",
      icon: Clock,
      tone: "text-muted-foreground bg-muted",
    },
  ];
  return (
    <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4", className)}>
      {items.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardDescription className="flex items-start justify-between gap-2 text-xs sm:text-sm">
                <span>{c.label}</span>
                <span
                  className={cn(
                    "hidden size-7 shrink-0 items-center justify-center rounded-md sm:flex",
                    c.tone,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
              </CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">{c.value}</CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <p className="text-muted-foreground text-xs">{c.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
