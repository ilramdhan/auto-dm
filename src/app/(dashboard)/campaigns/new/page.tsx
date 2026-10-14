import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { requireUser } from "@/server/auth/guard";

export const metadata: Metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  await requireUser();
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6">
      <PageHeader
        title="New campaign"
        description="Choose what to watch. You'll add keyword rules on the next step."
        breadcrumbs={[{ label: "Campaigns", href: "/campaigns" }, { label: "New" }]}
      />
      <Card>
        <CardContent>
          <CampaignForm />
        </CardContent>
      </Card>
    </div>
  );
}
