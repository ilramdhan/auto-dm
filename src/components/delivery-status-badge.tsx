import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Loader2,
  MinusCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DeliveryStatusValue } from "@/lib/validation/activity";

export const DELIVERY_STATUS_META: Record<
  DeliveryStatusValue,
  { label: string; icon: LucideIcon; variant: "success" | "warning" | "danger" | "muted" | "info" }
> = {
  received: { label: "Received", icon: Inbox, variant: "muted" },
  processing: { label: "Processing", icon: Loader2, variant: "info" },
  skipped: { label: "Skipped", icon: MinusCircle, variant: "muted" },
  sent: { label: "Sent", icon: CheckCircle2, variant: "success" },
  partial: { label: "Partial", icon: AlertTriangle, variant: "warning" },
  failed: { label: "Failed", icon: XCircle, variant: "danger" },
};

export function DeliveryStatusBadge({ status }: { status: DeliveryStatusValue }) {
  const meta = DELIVERY_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant}>
      <Icon aria-hidden />
      {meta.label}
    </Badge>
  );
}
