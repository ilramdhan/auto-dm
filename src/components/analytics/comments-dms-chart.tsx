"use client";

import { TimeSeriesChart } from "@/components/charts/time-series-chart";

type P = { day: string; comments: number; dmsSent: number };

/** Client wrapper so the series config (colors via CSS variables) lives in one place. */
export function CommentsVsDmsChart({
  data,
  compactMode,
  height,
}: {
  data: P[];
  compactMode?: boolean;
  height?: number;
}) {
  return (
    <TimeSeriesChart
      title="Comments received vs DMs sent per day"
      data={data}
      compactMode={compactMode}
      height={height}
      series={[
        { key: "comments", label: "Comments", color: "var(--viz-1)" },
        { key: "dmsSent", label: "DMs sent", color: "var(--viz-2)" },
      ]}
    />
  );
}
