import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { KpiGrid } from "@/components/analytics/kpi-grid";
import { ContentTable } from "@/components/analytics/content-table";
import { CommentsVsDmsChart } from "@/components/analytics/comments-dms-chart";
import { StatusBreakdown } from "@/components/charts/status-breakdown";
import { BarList } from "@/components/charts/bar-list";
import { analyticsFiltersSchema, resolveRange } from "@/lib/validation/analytics";
import { GRAPH_ERROR_HINTS, skipReasonLabel } from "@/lib/labels";
import { formatNumber, timeAgo, truncate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/guard";
import { getTimeZone } from "@/server/settings";
import { listCampaignOptions } from "@/server/repos/campaigns";
import {
  getDailySeries,
  getKeywordBreakdown,
  getKpis,
  getPerCampaign,
  getPerPost,
  getStatusBreakdown,
  getTopErrors,
  getTopSkipReasons,
} from "@/server/repos/analytics";
import { AnalyticsFilters } from "./filters";

export const metadata: Metadata = { title: "Analytics" };

type SP = Record<string, string | string[] | undefined>;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = await searchParams;
  const filters = analyticsFiltersSchema.parse(sp);
  const range = resolveRange(filters, new Date(), await getTimeZone());
  const scope = { range, campaignId: filters.campaign };

  const [campaigns, kpis, series, statuses, content, keywords, skips, errors] = await Promise.all([
    listCampaignOptions(),
    getKpis(scope),
    getDailySeries(scope),
    getStatusBreakdown(scope),
    filters.group === "post" ? getPerPost(scope) : getPerCampaign(scope),
    getKeywordBreakdown(scope),
    getTopSkipReasons(scope),
    getTopErrors(scope),
  ]);

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    p.set("range", range.preset);
    if (range.preset === "custom") {
      p.set("from", range.fromYmd);
      p.set("to", range.toYmd);
    }
    if (filters.campaign) p.set("campaign", filters.campaign);
    p.set("group", filters.group);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p.toString();
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Analytics"
        description={`${range.label} · days in ${range.timeZone}`}
        actions={
          <Button asChild variant="outline">
            <a href={`/analytics/export?${qs({})}`} download>
              <Download aria-hidden /> Download CSV
              <span className="sr-only"> of {range.label.toLowerCase()} analytics</span>
            </a>
          </Button>
        }
      />

      <AnalyticsFilters
        key={`${range.preset}-${range.fromYmd}-${range.toYmd}`}
        range={range.preset}
        from={range.fromYmd}
        to={range.toYmd}
        campaign={filters.campaign}
        campaigns={campaigns}
      />

      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          Key metrics
        </h2>
        <KpiGrid k={kpis} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Comments vs DMs sent</CardTitle>
            <CardDescription>Per day, {range.label.toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <CommentsVsDmsChart data={series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Outcome</CardTitle>
            <CardDescription>Final status of each comment</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusBreakdown data={statuses} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per content</CardTitle>
          <CardDescription>
            Comments, replies and DMs for each {filters.group === "post" ? "post or reel" : "campaign"}.
          </CardDescription>
          <CardAction>
            <nav aria-label="Group by" className="bg-muted inline-flex rounded-lg p-[3px] text-sm">
              {(["campaign", "post"] as const).map((g) => (
                <Link
                  key={g}
                  href={`/analytics?${qs({ group: g })}`}
                  scroll={false}
                  aria-current={filters.group === g ? "true" : undefined}
                  className={cn(
                    "focus-visible:ring-ring/50 rounded-md px-2.5 py-1 font-medium outline-none focus-visible:ring-[3px]",
                    filters.group === g
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {g === "campaign" ? "Campaign" : "Post"}
                </Link>
              ))}
            </nav>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ContentTable rows={content} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keywords</CardTitle>
          <CardDescription>Which keywords people comment, and what was delivered.</CardDescription>
        </CardHeader>
        <CardContent>
          {keywords.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No keyword matches in this period.
            </p>
          ) : (
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
                {keywords.map((k) => (
                  <TableRow key={`${k.ruleId}-${k.keyword}`}>
                    <TableCell>
                      <span className="bg-secondary rounded px-1.5 py-0.5 font-mono text-xs">
                        {k.keyword}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden max-w-64 truncate sm:table-cell">
                      {k.ruleName ?? "Deleted rule"} · {k.campaignName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(k.matches)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(k.dmsSent)}
                      {k.dmsFailed ? (
                        <span className="text-destructive text-xs"> ({k.dmsFailed} failed)</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {formatNumber(k.repliesSent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top skip reasons</CardTitle>
            <CardDescription>Why comments didn&apos;t trigger an action.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              color="var(--muted-foreground)"
              emptyText="Nothing skipped in this period."
              items={skips.map((s) => ({ key: s.reason, label: skipReasonLabel(s.reason), value: s.count }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top errors</CardTitle>
            <CardDescription>Grouped by Instagram API error code.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              color="var(--destructive)"
              emptyText="No errors in this period."
              items={errors.map((e) => ({
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
