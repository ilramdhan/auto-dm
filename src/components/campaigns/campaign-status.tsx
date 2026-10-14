import { CalendarClock, CircleCheck, CircleSlash, PauseCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type CampaignState = "active" | "paused" | "scheduled" | "ended";

export function campaignState(
  c: { isActive: boolean; startsAt: Date | string | null; endsAt: Date | string | null },
  now = new Date(),
): CampaignState {
  if (!c.isActive) return "paused";
  if (c.startsAt && new Date(c.startsAt) > now) return "scheduled";
  if (c.endsAt && new Date(c.endsAt) <= now) return "ended";
  return "active";
}

const META = {
  active: { label: "Active", icon: CircleCheck, variant: "success" },
  paused: { label: "Paused", icon: PauseCircle, variant: "muted" },
  scheduled: { label: "Scheduled", icon: CalendarClock, variant: "info" },
  ended: { label: "Ended", icon: CircleSlash, variant: "warning" },
} as const;

export function CampaignStatusBadge({ state }: { state: CampaignState }) {
  const m = META[state];
  const Icon = m.icon;
  return (
    <Badge variant={m.variant}>
      <Icon aria-hidden />
      {m.label}
    </Badge>
  );
}
