import { formatNumber } from "@/lib/format";

/** Ranked horizontal bars (HTML) — label + value always visible as text. */
export function BarList({
  items,
  emptyText,
  color = "var(--viz-1)",
}: {
  items: { key: string; label: React.ReactNode; value: number; hint?: React.ReactNode }[];
  emptyText: string;
  color?: string;
}) {
  if (items.length === 0) return <p className="text-muted-foreground text-sm">{emptyText}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="grid grid-cols-1 gap-3">
      {items.map((i) => (
        <li key={i.key} className="grid min-w-0 grid-cols-1 gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{i.label}</span>
            <span className="font-medium tabular-nums">{formatNumber(i.value)}</span>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
            <div
              className="h-full rounded-full"
              style={{ width: `${(i.value / max) * 100}%`, background: color }}
            />
          </div>
          {i.hint ? <div className="text-muted-foreground truncate text-xs">{i.hint}</div> : null}
        </li>
      ))}
    </ul>
  );
}
