import type { Metadata } from "next";
import Link from "next/link";
import { Globe, ImageOff, Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { CampaignActiveSwitch } from "@/components/campaigns/campaign-active-switch";
import { CampaignStatusBadge, campaignState } from "@/components/campaigns/campaign-status";
import { formatDateTime, truncate } from "@/lib/format";
import { requireUser } from "@/server/auth/guard";
import { listCampaigns } from "@/server/repos/campaigns";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  await requireUser();
  const campaigns = await listCampaigns();

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Campaigns"
        description="Each campaign watches one post (or all of them) and replies based on keyword rules."
        actions={
          campaigns.length > 0 ? (
            <Button asChild>
              <Link href="/campaigns/new">
                <Plus aria-hidden /> New campaign
              </Link>
            </Button>
          ) : null
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create a campaign, pick a post or reel, then add keywords and the DM to send when someone comments."
          action={
            <Button asChild>
              <Link href="/campaigns/new">
                <Plus aria-hidden /> Create your first campaign
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => {
            const state = campaignState(c);
            return (
              <li key={c.id}>
                <Card className="group hover:border-primary/40 relative h-full gap-0 overflow-hidden py-0 transition-colors">
                  <div className="flex gap-3 p-4">
                    {c.mediaThumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Instagram CDN URLs, not optimizable
                      <img
                        src={c.mediaThumbnailUrl}
                        alt=""
                        className="size-16 shrink-0 rounded-md border object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span
                        className="bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-md border"
                        aria-hidden
                      >
                        {c.mediaId ? <ImageOff className="size-5" /> : <Globe className="size-5" />}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold">
                        <Link
                          href={`/campaigns/${c.id}`}
                          className="rounded-sm outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                        >
                          {c.name}
                        </Link>
                      </h2>
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">
                        {c.description ||
                          (c.mediaCaption
                            ? truncate(c.mediaCaption, 100)
                            : c.mediaId
                              ? "Specific post"
                              : "Applies to every post & reel")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t px-4 py-3">
                    <CampaignStatusBadge state={state} />
                    <Badge variant="outline">{c.mediaId ? "One post" : "All posts"}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {c.ruleCount} {c.ruleCount === 1 ? "rule" : "rules"} · {c.keywordCount}{" "}
                      {c.keywordCount === 1 ? "keyword" : "keywords"}
                    </span>
                    <div className="relative z-10 ml-auto">
                      <CampaignActiveSwitch id={c.id} name={c.name} isActive={c.isActive} />
                    </div>
                  </div>
                  {c.endsAt || c.startsAt ? (
                    <p className="text-muted-foreground border-t px-4 py-2 text-xs">
                      {c.startsAt ? `From ${formatDateTime(c.startsAt)}` : ""}
                      {c.startsAt && c.endsAt ? " · " : ""}
                      {c.endsAt ? `Until ${formatDateTime(c.endsAt)}` : ""}
                    </p>
                  ) : null}
                  {c.ruleCount === 0 ? (
                    <p className="bg-warning/10 text-foreground border-t px-4 py-2 text-xs">
                      No rules yet — this campaign won&apos;t reply to anything.
                    </p>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
