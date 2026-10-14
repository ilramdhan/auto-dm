import { NextResponse, type NextRequest } from "next/server";
import { analyticsFiltersSchema, pct, resolveRange, toCsv } from "@/lib/validation/analytics";
import { requireUser } from "@/server/auth/guard";
import { getPerCampaign, getPerPost } from "@/server/repos/analytics";
import { logger } from "@/server/log";

export const dynamic = "force-dynamic";

/** CSV of the per-content table for the current analytics filters. */
export async function GET(req: NextRequest) {
  await requireUser();
  const filters = analyticsFiltersSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const range = resolveRange(filters);
  const scope = { range, campaignId: filters.campaign };
  try {
    const rows = filters.group === "post" ? await getPerPost(scope, 5000) : await getPerCampaign(scope);
    const csv = toCsv([
      [
        "content",
        "campaign_id",
        "media_id",
        "permalink",
        "comments",
        "matched",
        "public_replies_sent",
        "public_replies_failed",
        "dms_sent",
        "dms_failed",
        "success_rate_pct",
        "last_activity",
      ],
      ...rows.map((r) => [
        r.name,
        r.campaignId,
        r.mediaId,
        r.permalink,
        r.comments,
        r.matched,
        r.repliesSent,
        r.repliesFailed,
        r.dmsSent,
        r.dmsFailed,
        pct(r.delivered, r.matched),
        r.lastActivity,
      ]),
    ]);
    const filename = `auto-reply-ig-${filters.group}-${range.fromYmd}_${range.toYmd}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logger("analytics").error("export.failed", { err });
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
