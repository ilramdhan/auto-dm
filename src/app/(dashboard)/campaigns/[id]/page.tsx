import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, Globe, Settings2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { UrlTabs } from "@/components/url-tabs";
import { CampaignActiveSwitch } from "@/components/campaigns/campaign-active-switch";
import { CampaignStatusBadge, campaignState } from "@/components/campaigns/campaign-status";
import { DeleteCampaignButton } from "@/components/campaigns/delete-campaign-button";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { RulesEditor } from "@/components/campaigns/rules-editor";
import { TestCommentBox } from "@/components/campaigns/test-comment";
import { pct, resolveRange } from "@/lib/validation/analytics";
import { formatNumber, truncate } from "@/lib/format";
import { requireUser } from "@/server/auth/guard";
import { getCampaign } from "@/server/repos/campaigns";
import { listRules } from "@/server/repos/rules";
import { getKpis } from "@/server/repos/analytics";

type Params = { id: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Campaign" };
  const c = await getCampaign(id);
  return { title: c?.name ?? "Campaign" };
}

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ new?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const range = resolveRange({ range: "30d" });
  const [campaign, rules, kpis, sp] = await Promise.all([
    getCampaign(id),
    listRules(id),
    getKpis({ range, campaignId: id }),
    searchParams,
  ]);
  if (!campaign) notFound();
  const state = campaignState(campaign);

  const stats = [
    { label: "Comments", value: formatNumber(kpis.comments), sub: "last 30 days" },
    {
      label: "Matched",
      value: formatNumber(kpis.matched),
      sub: rate(pct(kpis.matched, kpis.comments), "match rate"),
    },
    {
      label: "Replies sent",
      value: formatNumber(kpis.repliesSent),
      sub: rate(pct(kpis.repliesSent, kpis.repliesSent + kpis.repliesFailed), "success"),
    },
    {
      label: "DMs sent",
      value: formatNumber(kpis.dmsSent),
      sub: rate(pct(kpis.dmsSent, kpis.dmsSent + kpis.dmsFailed), "success"),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Campaigns", href: "/campaigns" }, { label: campaign.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {campaign.name} <CampaignStatusBadge state={state} />
          </span>
        }
        description={
          campaign.mediaId ? (
            <span className="inline-flex flex-wrap items-center gap-x-2">
              {campaign.mediaCaption ? `“${truncate(campaign.mediaCaption, 80)}”` : "Specific post"}
              {campaign.mediaPermalink ? (
                <a
                  href={campaign.mediaPermalink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  View post <ExternalLink className="size-3" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : null}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Globe className="size-4" aria-hidden /> Applies to all posts &amp; reels
            </span>
          )
        }
        actions={
          <>
            <div className="flex h-9 items-center rounded-md border px-3">
              <CampaignActiveSwitch
                id={campaign.id}
                name={campaign.name}
                isActive={campaign.isActive}
                showLabel
              />
            </div>
            <DeleteCampaignButton id={campaign.id} name={campaign.name} />
          </>
        }
      />

      <section aria-labelledby="campaign-stats" className="rounded-xl border">
        <h2 id="campaign-stats" className="sr-only">
          Performance, last 30 days
        </h2>
        <dl className="grid grid-cols-2 divide-y sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {stats.map((s, i) => (
            <div key={s.label} className={i % 2 === 1 ? "border-l p-4 sm:border-l-0" : "p-4"}>
              <dt className="text-muted-foreground text-xs">{s.label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{s.value}</dd>
              <dd className="text-muted-foreground text-xs">{s.sub}</dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-end border-t px-2 py-1">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/analytics?campaign=${campaign.id}`}>
              Full analytics <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>

      <UrlTabs defaultValue="rules" values={["rules", "settings"]} className="gap-4">
        <TabsList>
          <TabsTrigger value="rules">
            <Zap aria-hidden /> Rules ({rules.length})
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 aria-hidden /> Settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rules">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <RulesEditor campaignId={campaign.id} rules={rules} startWithNew={sp.new === "1"} />
            <div className="lg:sticky lg:top-20">
              <TestCommentBox campaignId={campaign.id} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="settings">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Campaign settings</CardTitle>
              <CardDescription>Name, target content and schedule.</CardDescription>
            </CardHeader>
            <CardContent>
              <CampaignForm initial={campaign} />
            </CardContent>
          </Card>
        </TabsContent>
      </UrlTabs>
    </div>
  );
}

function rate(v: number | null, label: string): string {
  return v === null ? "no data yet" : `${v}% ${label}`;
}
