import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  MessageCircle,
  MessageSquareText,
  MinusCircle,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DeliveryStatusBadge } from "@/components/delivery-status-badge";
import { FlashToast, type Flash } from "@/components/flash-toast";
import { formatNumber, timeAgo, truncate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/guard";
import { getActiveAccount } from "@/server/instagram/account";
import { countCampaigns } from "@/server/repos/campaigns";
import { hasAnyDelivery, recentDeliveries } from "@/server/repos/deliveries";
import { getDashboardStats } from "@/server/repos/stats";
import { getDailySeries } from "@/server/repos/analytics";
import { resolveRange } from "@/lib/validation/analytics";
import { addDaysYmd, ymdInZone } from "@/lib/timezone";
import { CommentsVsDmsChart } from "@/components/analytics/comments-dms-chart";
import { getPublicSettings, getTimeZone } from "@/server/settings";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  await requireUser();
  const now = new Date();
  const timeZone = await getTimeZone();
  const today = ymdInZone(now, timeZone);
  const twoWeeks = resolveRange({ range: "custom", from: addDaysYmd(today, -13), to: today }, now, timeZone);
  const [{ welcome }, settings, account, campaignCount, anyDelivery, stats, recent, series] =
    await Promise.all([
      searchParams,
      getPublicSettings(),
      getActiveAccount(),
      countCampaigns(),
      hasAnyDelivery(),
      getDashboardStats(now, timeZone),
      recentDeliveries(8),
      getDailySeries({ range: twoWeeks }),
    ]);

  const steps = [
    {
      title: "Add your Meta app credentials",
      description: "Paste the Instagram App ID and App Secret from the Meta developer dashboard.",
      done: !!settings["meta.appId"].value && settings["meta.appSecret"].configured,
      href: "/settings?tab=instagram",
      cta: "Open Instagram settings",
    },
    {
      title: "Connect your Instagram account",
      description: "Authorize your professional (Business or Creator) account.",
      done: !!account,
      href: "/settings?tab=instagram",
      cta: "Connect Instagram",
    },
    {
      title: "Configure the webhook",
      description:
        "Add the callback URL and verify token in Meta. Done once the first comment from a second account arrives.",
      done: anyDelivery,
      href: "/settings?tab=instagram#webhook-diagnostics",
      cta: "Show webhook details",
    },
    {
      title: "Create your first campaign",
      description: "Pick a post (or all posts), add keywords and the DM to send.",
      done: campaignCount > 0,
      href: "/campaigns/new",
      cta: "New campaign",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const nextStep = steps.find((s) => !s.done);

  const flashes: Flash[] = welcome
    ? [
        {
          type: "success",
          message: "Password updated",
          description: "Welcome! Let's get your automation set up.",
        },
      ]
    : [];

  const cards = [
    {
      label: "Comments today",
      value: stats.commentsToday,
      sub: `${formatNumber(stats.comments7d)} in the last 7 days`,
      icon: MessageCircle,
      tone: "text-primary bg-primary/10",
    },
    {
      label: "DMs sent",
      value: stats.dmsSent7d,
      sub: `${formatNumber(stats.replies7d)} public replies · 7 days`,
      icon: Send,
      tone: "text-success bg-success/10",
    },
    {
      label: "Failed",
      value: stats.failed7d,
      sub: "Failed or partial · 7 days",
      icon: AlertTriangle,
      tone: "text-destructive bg-destructive/10",
      href: "/activity?status=failed",
    },
    {
      label: "Skipped",
      value: stats.skipped7d,
      sub: "No match, duplicate or paused · 7 days",
      icon: MinusCircle,
      tone: "text-muted-foreground bg-muted",
      href: "/activity?status=skipped",
    },
  ];

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

      {!allDone ? (
        <Card>
          <CardHeader>
            <CardTitle>Get set up</CardTitle>
            <CardDescription>
              {doneCount} of {steps.length} steps complete
            </CardDescription>
            <CardAction>
              <Badge variant="outline">{Math.round((doneCount / steps.length) * 100)}%</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div
              className="bg-muted mb-5 h-2 overflow-hidden rounded-full"
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-valuenow={doneCount}
            >
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${(doneCount / steps.length) * 100}%` }}
              />
            </div>
            <ol className="grid gap-3">
              {steps.map((step, i) => {
                const isNext = step === nextStep;
                return (
                  <li
                    key={step.title}
                    className={cn(
                      "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center",
                      isNext && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <div className="flex flex-1 items-start gap-3">
                      {step.done ? (
                        <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0" aria-hidden />
                      ) : (
                        <Circle className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "font-medium",
                            step.done && "text-muted-foreground line-through decoration-1",
                          )}
                        >
                          <span className="sr-only">{step.done ? "Done: " : "To do: "}</span>
                          {i + 1}. {step.title}
                        </p>
                        <p className="text-muted-foreground text-sm">{step.description}</p>
                      </div>
                    </div>
                    {!step.done ? (
                      <Button
                        asChild
                        size="sm"
                        variant={isNext ? "default" : "outline"}
                        className="self-start sm:self-auto"
                      >
                        <Link href={step.href}>
                          {step.cta}
                          <ArrowRight aria-hidden />
                        </Link>
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="stats-heading" className="grid gap-3">
        <h2 id="stats-heading" className="sr-only">
          Statistics
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((c) => {
            const Icon = c.icon;
            const body = (
              <Card className="h-full gap-3 py-5">
                <CardHeader className="px-5">
                  <CardDescription className="flex items-center justify-between gap-2 text-sm">
                    <span>{c.label}</span>
                    <span className={cn("flex size-8 items-center justify-center rounded-md", c.tone)}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                  </CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums sm:text-3xl">
                    {formatNumber(c.value)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5">
                  <p className="text-muted-foreground text-xs">{c.sub}</p>
                </CardContent>
              </Card>
            );
            return c.href ? (
              <Link
                key={c.label}
                href={c.href}
                className="focus-visible:ring-ring/50 rounded-xl transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-[3px]"
              >
                {body}
              </Link>
            ) : (
              <div key={c.label}>{body}</div>
            );
          })}
        </div>
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
          <CommentsVsDmsChart data={series} compactMode height={140} />
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
          {recent.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center text-sm">
              <MessageSquareText className="size-6" aria-hidden />
              <p>No comments yet. Once your webhook is connected, new comments show up here.</p>
              <p className="max-w-md text-xs">
                To test, comment from a second account (your own account&apos;s comments are ignored). In
                Development mode it must be an accepted Instagram Tester.{" "}
                <Link
                  href="/settings?tab=instagram#webhook-diagnostics"
                  className="text-foreground font-medium underline underline-offset-4"
                >
                  Webhook diagnostics
                </Link>
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {recent.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">@{d.commenterUsername ?? "unknown"}</span>{" "}
                      <span className="text-muted-foreground">{truncate(d.commentText ?? "", 90)}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {d.campaignName ?? "No campaign"}
                      {d.matchedKeyword ? <> · keyword “{d.matchedKeyword}”</> : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <DeliveryStatusBadge status={d.status} />
                    <time
                      className="text-muted-foreground text-xs whitespace-nowrap"
                      dateTime={d.createdAt.toISOString()}
                    >
                      {timeAgo(d.createdAt)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
