import { DELIVERY_STATUS_META } from "@/components/delivery-status-badge";
import type { DeliveryStatusValue } from "@/lib/validation/activity";
import { formatNumber } from "@/lib/format";

const COLOR: Record<DeliveryStatusValue, string> = {
  sent: "var(--success)",
  partial: "var(--warning)",
  failed: "var(--destructive)",
  skipped: "var(--muted-foreground)",
  received: "var(--info)",
  processing: "var(--info)",
};

/**
 * Status share as a donut (SVG) + labelled list. Identity never relies on color: every status has
 * an icon, a name, a count and a percentage in the list.
 */
export function StatusBreakdown({ data }: { data: { status: DeliveryStatusValue; count: number }[] }) {
  const total = data.reduce((a, d) => a + d.count, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  const GAP = total > 0 && data.filter((d) => d.count > 0).length > 1 ? 1.2 : 0;
  let offset = 0;
  const summary =
    total === 0
      ? "No comments in this period."
      : data
          .map(
            (d) =>
              `${DELIVERY_STATUS_META[d.status].label} ${d.count} (${Math.round((d.count / total) * 100)}%)`,
          )
          .join(", ");

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative size-36 shrink-0" role="img" aria-label={`Status breakdown: ${summary}`}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--muted)" strokeWidth="12" />
          {total > 0
            ? data.map((d) => {
                const len = (d.count / total) * C;
                const dash = Math.max(0, len - GAP);
                const el = (
                  <circle
                    key={d.status}
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    stroke={COLOR[d.status]}
                    strokeWidth="12"
                    strokeDasharray={`${dash} ${C - dash}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return el;
              })
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
          <span className="text-xl font-semibold tabular-nums">{formatNumber(total)}</span>
          <span className="text-muted-foreground text-[11px]">comments</span>
        </div>
      </div>
      <ul className="grid w-full gap-2 text-sm">
        {data.length === 0 ? <li className="text-muted-foreground">No comments in this period.</li> : null}
        {data.map((d) => {
          const meta = DELIVERY_STATUS_META[d.status];
          const Icon = meta.icon;
          return (
            <li key={d.status} className="flex items-center gap-2">
              <span
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ background: COLOR[d.status] }}
                aria-hidden
              />
              <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
              <span className="flex-1">{meta.label}</span>
              <span className="font-medium tabular-nums">{formatNumber(d.count)}</span>
              <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
                {total ? `${Math.round((d.count / total) * 100)}%` : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
