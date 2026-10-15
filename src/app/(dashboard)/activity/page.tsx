import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Info, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { DeliveryStatusBadge } from "@/components/delivery-status-badge";
import { DeleteCommenterButton } from "@/components/data-deletion/delete-commenter";
import { CSV_ROW_LIMIT } from "@/lib/csv";
import { ACTIVITY_PAGE_SIZE, activityFiltersSchema } from "@/lib/validation/activity";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import { skipReasonLabel } from "@/lib/labels";
import { requireUser } from "@/server/auth/guard";
import { listCampaignOptions } from "@/server/repos/campaigns";
import { listDeliveries, type DeliveryRow } from "@/server/repos/deliveries";
import { ActivityFilters } from "./filters";

export const metadata: Metadata = { title: "Activity" };

function detail(d: DeliveryRow): string | null {
  if (d.error) return d.errorCode ? `Error ${d.errorCode}: ${d.error}` : d.error;
  if (d.status === "skipped") return skipReasonLabel(d.skipReason);
  return null;
}

function StatusCell({ d }: { d: DeliveryRow }) {
  const info = detail(d);
  if (!info) return <DeliveryStatusBadge status={d.status} />;
  return (
    <span className="inline-flex items-center gap-1">
      <DeliveryStatusBadge status={d.status} />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm p-0.5 outline-none focus-visible:ring-[3px]"
          >
            <Info className="size-3.5" aria-hidden />
            <span className="sr-only">Details: {info}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{info}</TooltipContent>
      </Tooltip>
    </span>
  );
}

function Outcome({ d }: { d: DeliveryRow }) {
  const parts: string[] = [];
  if (d.publicReplyStatus !== "not_attempted")
    parts.push(`Reply ${d.publicReplyStatus === "sent" ? "sent" : "failed"}`);
  if (d.dmStatus !== "not_attempted") parts.push(`DM ${d.dmStatus === "sent" ? "sent" : "failed"}`);
  return parts.length ? <span className="text-muted-foreground text-xs">{parts.join(" · ")}</span> : null;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const filters = activityFiltersSchema.parse(await searchParams);
  const [{ items, total }, campaigns] = await Promise.all([listDeliveries(filters), listCampaignOptions()]);
  const pages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const hasFilters = !!(filters.status || filters.campaign || filters.q);

  const filterParams = () => {
    const sp = new URLSearchParams();
    if (filters.status) sp.set("status", filters.status);
    if (filters.campaign) sp.set("campaign", filters.campaign);
    if (filters.q) sp.set("q", filters.q);
    return sp;
  };
  const pageHref = (p: number) => {
    const sp = filterParams();
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/activity?${qs}` : "/activity";
  };
  const exportQs = filterParams().toString();
  const exportHref = exportQs ? `/activity/export?${exportQs}` : "/activity/export";

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Activity"
        description="Every comment received and what the automation did with it."
        actions={
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button asChild variant="outline">
              <a href={exportHref} download>
                <Download aria-hidden /> Download CSV
                <span className="sr-only"> of activity{hasFilters ? " (current filters)" : ""}</span>
              </a>
            </Button>
            {total > CSV_ROW_LIMIT ? (
              <p className="text-muted-foreground text-xs">
                Showing the first {formatNumber(CSV_ROW_LIMIT)} rows of {formatNumber(total)} in the CSV.
              </p>
            ) : null}
          </div>
        }
      />
      <ActivityFilters
        status={filters.status}
        campaign={filters.campaign}
        q={filters.q}
        campaigns={campaigns}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title={hasFilters ? "No matching activity" : "No activity yet"}
          description={
            hasFilters
              ? "Try a different search or clear the filters."
              : "When someone comments on your posts, it shows up here with the reply and DM status."
          }
          action={
            hasFilters ? (
              <Button asChild variant="outline">
                <Link href="/activity">Clear filters</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/settings?tab=instagram#webhook">Check webhook setup</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <Card className="hidden py-0 md:block">
            <CardContent className="px-0">
              <Table>
                <caption className="sr-only">
                  Comments, page {page} of {pages}
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Time</TableHead>
                    <TableHead>Commenter</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Campaign · rule</TableHead>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12 pr-4">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="pl-4">
                        <time
                          dateTime={d.createdAt.toISOString()}
                          title={formatDateTime(d.createdAt)}
                          className="text-muted-foreground text-xs"
                        >
                          {timeAgo(d.createdAt)}
                        </time>
                      </TableCell>
                      <TableCell className="font-medium">@{d.commenterUsername ?? "unknown"}</TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate" title={d.commentText ?? undefined}>
                          {d.commentText || <span className="text-muted-foreground italic">empty</span>}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-56">
                        {d.campaignId ? (
                          <Link
                            href={`/campaigns/${d.campaignId}`}
                            className="block truncate hover:underline"
                          >
                            {d.campaignName ?? "Deleted campaign"}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {d.ruleName ? (
                          <span className="text-muted-foreground block truncate text-xs">{d.ruleName}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {d.matchedKeyword ? (
                          <span className="bg-secondary rounded px-1.5 py-0.5 font-mono text-xs">
                            {d.matchedKeyword}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="grid gap-0.5">
                          <StatusCell d={d} />
                          <Outcome d={d} />
                        </div>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <DeleteCommenterButton commenterId={d.commenterId} username={d.commenterUsername} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <ul className="grid gap-3 md:hidden" aria-label={`Comments, page ${page} of ${pages}`}>
            {items.map((d) => (
              <li key={d.id} className="bg-card rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">@{d.commenterUsername ?? "unknown"}</p>
                    <time dateTime={d.createdAt.toISOString()} className="text-muted-foreground text-xs">
                      {timeAgo(d.createdAt)}
                    </time>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StatusCell d={d} />
                    <DeleteCommenterButton commenterId={d.commenterId} username={d.commenterUsername} />
                  </div>
                </div>
                <p className="mt-2 text-sm break-words">
                  {d.commentText || <span className="text-muted-foreground italic">empty</span>}
                </p>
                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  {d.campaignName ? <span>{d.campaignName}</span> : null}
                  {d.ruleName ? <span>· {d.ruleName}</span> : null}
                  {d.matchedKeyword ? (
                    <span className="bg-secondary text-foreground rounded px-1.5 py-0.5 font-mono">
                      {d.matchedKeyword}
                    </span>
                  ) : null}
                  <Outcome d={d} />
                </div>
                {detail(d) ? (
                  <p className="text-muted-foreground mt-2 border-t pt-2 text-xs break-words">{detail(d)}</p>
                ) : null}
              </li>
            ))}
          </ul>

          <nav
            aria-label="Pagination"
            className="flex flex-col items-center justify-between gap-3 sm:flex-row"
          >
            <p className="text-muted-foreground text-sm">
              {formatNumber((page - 1) * ACTIVITY_PAGE_SIZE + 1)}–
              {formatNumber(Math.min(page * ACTIVITY_PAGE_SIZE, total))} of {formatNumber(total)}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(page - 1)} rel="prev">
                    <ChevronLeft aria-hidden /> Previous
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  <ChevronLeft aria-hidden /> Previous
                </Button>
              )}
              <span className="text-muted-foreground text-sm tabular-nums" aria-current="page">
                Page {page} of {pages}
              </span>
              {page < pages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(page + 1)} rel="next">
                    Next <ChevronRight aria-hidden />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next <ChevronRight aria-hidden />
                </Button>
              )}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
