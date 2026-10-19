import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, MessageSquareWarning } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ManualSendButton, type ManualRuleOption } from "@/components/skipped/manual-send-dialog";
import { SkipReasonFilter } from "@/components/skipped/reason-filter";
import { SyncMissedComments } from "@/components/skipped/sync-missed";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import { skipReasonExplanation, skipReasonLabel } from "@/lib/labels";
import { SKIPPED_PAGE_SIZE, skippedFiltersSchema } from "@/lib/validation/skipped";
import { requireUser } from "@/server/auth/guard";
import { manualRuleCandidates, manualSendBlocker, preselectRuleId } from "@/server/engine/manual";
import type { CampaignWithRules } from "@/server/engine/pick";
import { loadActiveCampaigns } from "@/server/engine/resolve";
import { getActiveAccount } from "@/server/instagram/account";
import { listSkippedDeliveries, type SkippedRow } from "@/server/repos/deliveries";
import { getSetting } from "@/server/settings";

export const metadata: Metadata = { title: "Skipped comments" };

const SOURCE_LABELS: Record<SkippedRow["source"], string> = {
  webhook: "Webhook",
  n8n: "n8n",
  manual: "Manual / sync",
};

function ruleOptions(all: CampaignWithRules[], d: SkippedRow): ManualRuleOption[] {
  return manualRuleCandidates(all, d).map(({ campaign, rule }) => ({
    id: rule.id,
    name: rule.name,
    campaignName: campaign.name,
    keywords: rule.keywords,
    matchMode: rule.matchMode,
    publicReplies: rule.publicReplies,
    dmMessage: rule.dmMessage,
    dmButtonTitle: rule.dmButtonTitle,
    dmButtonUrl: rule.dmButtonUrl,
    oncePerUser: rule.oncePerUser,
  }));
}

function Post({ d }: { d: SkippedRow }) {
  if (!d.mediaId) return <span className="text-muted-foreground">Unknown post</span>;
  if (d.mediaPermalink)
    return (
      <a
        href={d.mediaPermalink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 underline underline-offset-4"
      >
        View post
        <ExternalLink className="size-3" aria-hidden />
        <span className="sr-only"> (opens Instagram in a new tab)</span>
      </a>
    );
  return (
    <span className="font-mono text-xs break-all" title="Instagram media id">
      Post {d.mediaId}
    </span>
  );
}

export default async function SkippedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const filters = skippedFiltersSchema.parse(await searchParams);
  const now = new Date();
  const [{ items, total }, account, enabled] = await Promise.all([
    listSkippedDeliveries(filters),
    getActiveAccount(),
    getSetting("processing.enabled"),
  ]);
  const active = account ? await loadActiveCampaigns({ accountId: account.id, now }) : [];
  const postCampaigns = active
    .filter((c) => c.campaign.mediaId !== null)
    .map((c) => ({ id: c.campaign.id, name: c.campaign.name }));
  const paused = enabled === false;
  const connected = !!account?.accessTokenEnc;
  const globalBlocker = !connected
    ? "Connect Instagram in Settings first."
    : paused
      ? "Automation is paused (Settings → Processing)."
      : null;

  const pages = Math.max(1, Math.ceil(total / SKIPPED_PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (filters.reason) sp.set("reason", filters.reason);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/skipped?${qs}` : "/skipped";
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Skipped comments"
        description="Comments the automation didn't answer, and why. Send one manually within 7 days of the comment."
      />

      {paused ? (
        <Alert>
          <AlertTitle>Automation is paused</AlertTitle>
          <AlertDescription>
            Manual sends are off too while the kill switch is on.{" "}
            <Link href="/settings?tab=processing" className="underline underline-offset-4">
              Open Settings → Processing
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {connected && postCampaigns.length > 0 ? <SyncMissedComments campaigns={postCampaigns} /> : null}

      <SkipReasonFilter reason={filters.reason} />

      {items.length === 0 ? (
        <EmptyState
          icon={MessageSquareWarning}
          title="No skipped comments"
          description={
            filters.reason
              ? "Nothing with this reason. Try another reason."
              : "Every comment that could be answered was. Own comments are hidden; pick “All reasons” to see them."
          }
          action={
            filters.reason ? (
              <Button asChild variant="outline">
                <Link href="/skipped">Clear filter</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="grid gap-3" aria-label={`Skipped comments, page ${page} of ${pages}`}>
            {items.map((d) => {
              const rules = ruleOptions(active, d);
              const explanation = skipReasonExplanation(d.skipReason, { campaignName: d.campaignName });
              return (
                <li key={d.id} className="bg-card grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_auto]">
                  <div className="grid min-w-0 gap-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium break-all">@{d.commenterUsername ?? "unknown"}</span>
                      <time
                        dateTime={d.createdAt.toISOString()}
                        title={formatDateTime(d.createdAt)}
                        className="text-muted-foreground text-xs"
                      >
                        {timeAgo(d.createdAt, now)}
                      </time>
                      <span className="text-muted-foreground text-xs">
                        <Post d={d} />
                      </span>
                      <span className="text-muted-foreground text-xs">Source: {SOURCE_LABELS[d.source]}</span>
                    </div>
                    <p className="text-sm break-words">
                      {d.commentText || <span className="text-muted-foreground italic">empty</span>}
                    </p>
                    <div className="grid gap-1">
                      <p className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="muted" className="whitespace-normal">
                          Reason: {skipReasonLabel(d.skipReason)}
                        </Badge>
                        {d.campaignName ? (
                          <span className="text-muted-foreground">
                            {d.campaignName}
                            {d.ruleName ? ` · ${d.ruleName}` : ""}
                          </span>
                        ) : null}
                      </p>
                      {explanation ? (
                        <p className="text-muted-foreground max-w-prose text-xs">{explanation}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="md:justify-self-end">
                    <ManualSendButton
                      deliveryId={d.id}
                      username={d.commenterUsername}
                      commentText={d.commentText}
                      rules={rules}
                      preselectedRuleId={preselectRuleId(d, active, { isReply: false })}
                      disabledReason={manualSendBlocker(d, now) ?? globalBlocker}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <nav
            aria-label="Pagination"
            className="flex flex-col items-center justify-between gap-3 sm:flex-row"
          >
            <p className="text-muted-foreground text-sm">
              {formatNumber((page - 1) * SKIPPED_PAGE_SIZE + 1)}–
              {formatNumber(Math.min(page * SKIPPED_PAGE_SIZE, total))} of {formatNumber(total)}
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
