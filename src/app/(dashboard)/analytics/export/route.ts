import { NextResponse, type NextRequest } from "next/server";
import { appSlug, CSV_ROW_LIMIT, csvHeaders, formatCsvDateTime, toCsv } from "@/lib/csv";
import { analyticsFiltersSchema, pct, resolveRange } from "@/lib/validation/analytics";
import { requireUser } from "@/server/auth/guard";
import { getTimeZone } from "@/server/settings";
import { getPerCampaign, getPerPost } from "@/server/repos/analytics";
import { logger } from "@/server/log";

export const dynamic = "force-dynamic";

/** CSV of the per-content table for the current analytics filters. */
export async function GET(req: NextRequest) {
  await requireUser();
  const filters = analyticsFiltersSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const range = resolveRange(filters, new Date(), await getTimeZone());
  const scope = { range, campaignId: filters.campaign };
  try {
    const rows =
      filters.group === "post" ? await getPerPost(scope, CSV_ROW_LIMIT) : await getPerCampaign(scope);
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
        `last_activity (${range.timeZone})`,
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
        formatCsvDateTime(r.lastActivity, range.timeZone),
      ]),
    ]);
    const filename = `${appSlug()}-analytics-${filters.group}-${range.fromYmd}_${range.toYmd}.csv`;
    return new NextResponse(csv, { headers: csvHeaders(filename) });
  } catch (err) {
    logger("analytics").error("export.failed", { err });
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
