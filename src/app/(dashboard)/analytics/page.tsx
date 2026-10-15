import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SectionSkeleton } from "@/components/section-skeleton";
import { analyticsFiltersSchema, resolveRange } from "@/lib/validation/analytics";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/guard";
import { getTimeZone } from "@/server/settings";
import { listCampaignOptions } from "@/server/repos/campaigns";
import {
  getDailySeries,
  getKeywordBreakdown,
  getOverview,
  getPerCampaign,
  getPerPost,
  getTopErrors,
} from "@/server/repos/analytics";
import { startTimer, watchSections } from "@/server/diagnostics";
import { logger } from "@/server/log";
import { AnalyticsFilters } from "./filters";
import {
  ContentSection,
  ErrorsSection,
  KeywordsSection,
  KpiSection,
  KpiSkeleton,
  OutcomeSection,
  SeriesSection,
  SkipReasonsSection,
  TableSkeleton,
} from "./sections";

export const metadata: Metadata = { title: "Analytics" };

type SP = Record<string, string | string[] | undefined>;

/**
 * Streams: the header and filters render as soon as the session and time zone are known; every
 * section below sits in its own <Suspense> and appears when its query finishes (#86). All queries
 * start here, at once, so they run in parallel; the components only await them.
 */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const startedAt = startTimer();
  // The time zone is not sensitive and nothing renders before requireUser() resolves, so both go out
  // together (the session lookup is also memoized from the layout).
  const [, sp, timeZone] = await Promise.all([requireUser(), searchParams, getTimeZone()]);
  const filters = analyticsFiltersSchema.parse(sp);
  const range = resolveRange(filters, new Date(), timeZone);
  const scope = { range, campaignId: filters.campaign };

  const campaigns = listCampaignOptions();
  const overview = getOverview(scope);
  const series = getDailySeries(scope);
  const content = filters.group === "post" ? getPerPost(scope) : getPerCampaign(scope);
  const keywords = getKeywordBreakdown(scope);
  const errors = getTopErrors(scope);

  after(
    watchSections(
      { campaigns, overview, series, content, keywords, errors },
      (info) =>
        logger("analytics").warn("analytics.slow", { ...info, rangeDays: range.days, group: filters.group }),
      { startedAt },
    ),
  );

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
        <Suspense fallback={<KpiSkeleton />}>
          <KpiSection overview={overview} />
        </Suspense>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Comments vs DMs sent</CardTitle>
            <CardDescription>Per day, {range.label.toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<SectionSkeleton label="daily chart" className="h-[220px]" />}>
              <SeriesSection series={series} />
            </Suspense>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Outcome</CardTitle>
            <CardDescription>Final status of each comment</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<SectionSkeleton label="outcome breakdown" className="h-64" />}>
              <OutcomeSection overview={overview} />
            </Suspense>
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
          <Suspense fallback={<TableSkeleton label="per-content table" />}>
            <ContentSection content={content} />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keywords</CardTitle>
          <CardDescription>Which keywords people comment, and what was delivered.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<TableSkeleton label="keywords" rows={3} />}>
            <KeywordsSection keywords={keywords} />
          </Suspense>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top skip reasons</CardTitle>
            <CardDescription>Why comments didn&apos;t trigger an action.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<TableSkeleton label="skip reasons" rows={3} />}>
              <SkipReasonsSection overview={overview} />
            </Suspense>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top errors</CardTitle>
            <CardDescription>Grouped by Instagram API error code.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<TableSkeleton label="errors" rows={3} />}>
              <ErrorsSection errors={errors} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
