import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { FlashToast, type Flash } from "@/components/flash-toast";
import { SectionSkeleton } from "@/components/section-skeleton";
import { requireUser } from "@/server/auth/guard";
import { getActiveAccount } from "@/server/instagram/account";
import { countCampaigns } from "@/server/repos/campaigns";
import { hasAnyDelivery, recentDeliveries } from "@/server/repos/deliveries";
import { getDashboardStats } from "@/server/repos/stats";
import { getDailySeries } from "@/server/repos/analytics";
import { resolveRange } from "@/lib/validation/analytics";
import { addDaysYmd, ymdInZone } from "@/lib/timezone";
import { getPublicSettings, getTimeZone } from "@/server/settings";
import { startTimer, watchSections } from "@/server/diagnostics";
import { logger } from "@/server/log";
import {
  RecentSection,
  RecentSkeleton,
  SeriesSection,
  SetupSection,
  StatsSection,
  StatsSkeleton,
  type SetupState,
} from "./sections";

export const metadata: Metadata = { title: "Dashboard" };

async function getSetupState(): Promise<SetupState> {
  const [settings, account, anyDelivery, campaignCount] = await Promise.all([
    getPublicSettings(),
    getActiveAccount(),
    hasAnyDelivery(),
    countCampaigns(),
  ]);
  return {
    credentials: !!settings["meta.appId"].value && settings["meta.appSecret"].configured,
    account: !!account,
    webhook: anyDelivery,
    campaign: campaignCount > 0,
  };
}

/**
 * Streams like /analytics (#86): the header renders once the session and time zone are known, and
 * each section appears as soon as its own query finishes instead of waiting for the slowest one.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const startedAt = startTimer();
  const [, { welcome }, timeZone] = await Promise.all([requireUser(), searchParams, getTimeZone()]);
  const now = new Date();
  const today = ymdInZone(now, timeZone);
  const twoWeeks = resolveRange({ range: "custom", from: addDaysYmd(today, -13), to: today }, now, timeZone);

  const setup = getSetupState();
  const stats = getDashboardStats(now, timeZone);
  const series = getDailySeries({ range: twoWeeks });
  const recent = recentDeliveries(8);

  after(
    watchSections({ setup, stats, series, recent }, (info) => logger("app").warn("dashboard.slow", info), {
      startedAt,
    }),
  );

  const flashes: Flash[] = welcome
    ? [
        {
          type: "success",
          message: "Password updated",
          description: "Welcome! Let's get your automation set up.",
        },
      ]
    : [];

  return (
    <div className="grid grid-cols-1 gap-6">
      <FlashToast flashes={flashes} clearParams={["welcome"]} />
      <PageHeader
        title="Dashboard"
        description="Overview of your comment automations."
        actions={
          <Button asChild>
            <Link href="/campaigns/new">New campaign</Link>
          </Button>
        }
      />

      {/* No fallback: once set up (the common case) this renders nothing, so a placeholder would only flash. */}
      <Suspense fallback={null}>
        <SetupSection state={setup} />
      </Suspense>

      <section aria-labelledby="stats-heading" className="grid gap-3">
        <h2 id="stats-heading" className="sr-only">
          Statistics
        </h2>
        <Suspense fallback={<StatsSkeleton />}>
          <StatsSection stats={stats} />
        </Suspense>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Last 14 days</CardTitle>
          <CardDescription>Comments received vs DMs sent per day ({timeZone}).</CardDescription>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href="/analytics">
                Analytics <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<SectionSkeleton label="daily chart" className="h-[140px]" />}>
            <SeriesSection series={series} />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>The latest comments processed by your automations.</CardDescription>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href="/activity">
                View all <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<RecentSkeleton />}>
            <RecentSection recent={recent} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
