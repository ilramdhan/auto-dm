import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiGrid } from "@/components/analytics/kpi-grid";
import { ContentTable } from "@/components/analytics/content-table";
import { CommentsVsDmsChart } from "@/components/analytics/comments-dms-chart";
import { StatusBreakdown } from "@/components/charts/status-breakdown";
import { BarList } from "@/components/charts/bar-list";
import { RowsSkeleton, SectionSkeleton } from "@/components/section-skeleton";
import { GRAPH_ERROR_HINTS, skipReasonLabel } from "@/lib/labels";
import { formatNumber, timeAgo, truncate } from "@/lib/format";
import type { ContentRow, DayPoint, KeywordRow, Overview, TopError } from "@/server/repos/analytics";

/*
 * Analytics sections, each rendered inside its own <Suspense> by page.tsx. They receive the query
 * promise (started by the page, so every query runs in parallel) and await it themselves, so a fast
 * section shows as soon as its own data arrives instead of waiting for the slowest one (#86).
 */

/* ---------------------------------- KPIs ---------------------------------- */

export async function KpiSection({ overview }: { overview: Promise<Overview> }) {
  const { kpis } = await overview;
  return <KpiGrid k={kpis} />;
}

export function KpiSkeleton() {
  return (
    <SectionSkeleton label="key metrics">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </SectionSkeleton>
  );
}

/* ------------------------------ chart + outcome ------------------------------ */

export async function SeriesSection({ series }: { series: Promise<DayPoint[]> }) {
  return <CommentsVsDmsChart data={await series} />;
}

export async function OutcomeSection({ overview }: { overview: Promise<Overview> }) {
  return <StatusBreakdown data={(await overview).statuses} />;
}

/* ------------------------------- content table ------------------------------- */

export async function ContentSection({ content }: { content: Promise<ContentRow[]> }) {
  return <ContentTable rows={await content} />;
}

export function TableSkeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <SectionSkeleton label={label}>
      <RowsSkeleton rows={rows} />
    </SectionSkeleton>
  );
}

/* --------------------------------- keywords --------------------------------- */

export async function KeywordsSection({ keywords }: { keywords: Promise<KeywordRow[]> }) {
  const rows = await keywords;
  if (rows.length === 0)
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">No keyword matches in this period.</p>
    );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Keyword</TableHead>
          <TableHead className="hidden sm:table-cell">Rule · campaign</TableHead>
          <TableHead className="text-right">Matches</TableHead>
          <TableHead className="text-right">DMs sent</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Replies</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((k) => (
          <TableRow key={`${k.ruleId}-${k.keyword}`}>
            <TableCell>
              <span className="bg-secondary rounded px-1.5 py-0.5 font-mono text-xs">{k.keyword}</span>
            </TableCell>
            <TableCell className="text-muted-foreground hidden max-w-64 truncate sm:table-cell">
              {k.ruleName ?? "Deleted rule"} · {k.campaignName ?? "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(k.matches)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(k.dmsSent)}
              {k.dmsFailed ? <span className="text-destructive text-xs"> ({k.dmsFailed} failed)</span> : null}
            </TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">
              {formatNumber(k.repliesSent)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ---------------------------- skip reasons / errors ---------------------------- */

export async function SkipReasonsSection({ overview }: { overview: Promise<Overview> }) {
  const { skips } = await overview;
  return (
    <BarList
      color="var(--muted-foreground)"
      emptyText="Nothing skipped in this period."
      items={skips.map((s) => ({ key: s.reason, label: skipReasonLabel(s.reason), value: s.count }))}
    />
  );
}

export async function ErrorsSection({ errors }: { errors: Promise<TopError[]> }) {
  const rows = await errors;
  return (
    <BarList
      color="var(--destructive)"
      emptyText="No errors in this period."
      items={rows.map((e) => ({
        key: e.code,
        label: (
          <>
            <span className="font-mono text-xs">#{e.code}</span>{" "}
            {GRAPH_ERROR_HINTS[e.code] ?? (e.sample ? truncate(e.sample, 60) : "Error")}
          </>
        ),
        value: e.count,
        hint: e.last ? `Last seen ${timeAgo(e.last)}` : undefined,
      }))}
    />
  );
}
