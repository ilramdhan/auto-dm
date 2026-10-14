"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { compact, niceTicks, shortDay } from "./scale";

export type SeriesDef<K extends string> = { key: K; label: string; color: string };
type Point<K extends string> = { day: string } & Record<K, number>;

/**
 * Accessible, dependency-free line chart (one y-axis, UTC days on x).
 * Plot is SVG (non-scaling strokes); axes/labels/tooltip are HTML so text stays crisp at any width.
 * Keyboard: focus the chart and use ←/→ (Home/End) to move the crosshair. A data table fallback is included.
 */
export function TimeSeriesChart<K extends string>({
  data,
  series,
  title,
  height = 220,
  compactMode = false,
  className,
}: {
  data: Point<K>[];
  series: SeriesDef<K>[];
  title: string;
  height?: number;
  compactMode?: boolean;
  className?: string;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const n = data.length;
  const max = useMemo(() => Math.max(0, ...data.flatMap((p) => series.map((s) => p[s.key]))), [data, series]);
  const ticks = useMemo(() => niceTicks(max, compactMode ? 2 : 4), [max, compactMode]);
  const top = ticks[ticks.length - 1] || 1;
  const W = 1000;
  const H = 1000;
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (v / top) * H;

  const totals = series.map((s) => ({ ...s, total: data.reduce((a, p) => a + p[s.key], 0) }));
  const summary = `${title}. ${n} days from ${n ? shortDay(data[0]!.day) : ""} to ${n ? shortDay(data[n - 1]!.day) : ""}. ${totals
    .map((t) => `${t.label}: ${t.total} total`)
    .join(", ")}. Peak day value ${max}.`;

  function onPointer(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setActive(n <= 1 ? 0 : Math.round(ratio * (n - 1)));
  }
  function onKey(e: React.KeyboardEvent) {
    if (!n) return;
    const cur = active ?? n - 1;
    const next =
      e.key === "ArrowRight"
        ? Math.min(n - 1, cur + 1)
        : e.key === "ArrowLeft"
          ? Math.max(0, cur - 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (next !== null) {
      e.preventDefault();
      setActive(next);
    }
  }

  const point = active !== null ? data[active] : undefined;
  const leftPct = active !== null ? (x(active) / W) * 100 : 0;
  const labelIdx =
    n <= 1 ? [0] : compactMode ? [0, n - 1] : Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1]));

  return (
    <figure className={cn("grid gap-3", className)} aria-labelledby={`${id}-cap`}>
      <figcaption id={`${id}-cap`} className="sr-only">
        {summary}
      </figcaption>
      {series.length > 1 ? (
        <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legend">
          {totals.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 rounded-full"
                style={{ background: s.color }}
                aria-hidden
              />
              <span className="text-foreground font-medium">{s.label}</span>
              <span className="tabular-nums">{compact(s.total)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        {!compactMode ? (
          <div
            className="text-muted-foreground relative w-8 shrink-0 text-right text-[11px] tabular-nums"
            style={{ height }}
            aria-hidden
          >
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute right-0 -translate-y-1/2"
                style={{ top: `${100 - (t / top) * 100}%` }}
              >
                {compact(t)}
              </span>
            ))}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div
            role="img"
            aria-label={summary}
            tabIndex={0}
            onKeyDown={onKey}
            onPointerMove={onPointer}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            className="focus-visible:ring-ring/50 relative touch-pan-y rounded-sm outline-none focus-visible:ring-[3px]"
            style={{ height }}
          >
            {ticks.map((t) => (
              <div
                key={t}
                aria-hidden
                className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-border" : "bg-border/60")}
                style={{ top: `${100 - (t / top) * 100}%` }}
              />
            ))}
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible"
              aria-hidden
            >
              {series.map((s, si) => {
                const line = data.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p[s.key])}`).join(" ");
                return (
                  <g key={s.key}>
                    {si === 0 && n > 1 ? (
                      <path d={`${line} L${x(n - 1)},${H} L${x(0)},${H} Z`} fill={s.color} opacity={0.1} />
                    ) : null}
                    <path
                      d={line}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
            </svg>
            {point ? (
              <>
                <div
                  aria-hidden
                  className="bg-foreground/30 pointer-events-none absolute inset-y-0 w-px"
                  style={{ left: `${leftPct}%` }}
                />
                {series.map((s) => (
                  <span
                    key={s.key}
                    aria-hidden
                    className="ring-card pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
                    style={{
                      left: `${leftPct}%`,
                      top: `${(y(point[s.key]) / H) * 100}%`,
                      background: s.color,
                    }}
                  />
                ))}
                <div
                  aria-hidden
                  className="bg-popover text-popover-foreground pointer-events-none absolute top-1 z-10 min-w-32 rounded-md border px-2.5 py-2 text-xs shadow-md"
                  style={
                    leftPct > 60
                      ? { right: `${100 - leftPct}%`, marginRight: 8 }
                      : { left: `${leftPct}%`, marginLeft: 8 }
                  }
                >
                  <p className="mb-1 font-medium">{shortDay(point.day)}</p>
                  {series.map((s) => (
                    <p key={s.key} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block size-2 rounded-full" style={{ background: s.color }} />
                        <span className="text-muted-foreground">{s.label}</span>
                      </span>
                      <span className="font-medium tabular-nums">{point[s.key]}</span>
                    </p>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          <div className="text-muted-foreground relative mt-1.5 h-4 text-[11px]" aria-hidden>
            {labelIdx.map((i) => (
              <span
                key={i}
                className={cn(
                  "absolute whitespace-nowrap",
                  i === 0 ? "left-0" : i === n - 1 ? "right-0" : "-translate-x-1/2",
                )}
                style={i !== 0 && i !== n - 1 ? { left: `${(x(i) / W) * 100}%` } : undefined}
              >
                {data[i] ? shortDay(data[i]!.day) : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {point ? `${shortDay(point.day)}: ${series.map((s) => `${s.label} ${point[s.key]}`).join(", ")}` : ""}
      </p>
      {!compactMode ? (
        <details className="text-sm">
          <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer rounded-sm text-xs">
            Show data table
          </summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <caption className="sr-only">{title}</caption>
              <thead className="bg-muted/60 sticky top-0">
                <tr>
                  <th scope="col" className="px-2 py-1.5 text-left font-medium">
                    Day (UTC)
                  </th>
                  {series.map((s) => (
                    <th key={s.key} scope="col" className="px-2 py-1.5 text-right font-medium">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.day} className="border-t">
                    <th scope="row" className="px-2 py-1 text-left font-normal">
                      {p.day}
                    </th>
                    {series.map((s) => (
                      <td key={s.key} className="px-2 py-1 text-right tabular-nums">
                        {p[s.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </figure>
  );
}
