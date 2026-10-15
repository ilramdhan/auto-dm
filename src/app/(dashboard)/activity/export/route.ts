import { NextResponse, type NextRequest } from "next/server";
import { appSlug, CSV_ROW_LIMIT, csvHeaders, formatCsvDateTime, toCsv } from "@/lib/csv";
import { ymdInZone } from "@/lib/timezone";
import { activityFiltersSchema } from "@/lib/validation/activity";
import { requireUser } from "@/server/auth/guard";
import { listDeliveries } from "@/server/repos/deliveries";
import { logger } from "@/server/log";
import { getTimeZone } from "@/server/settings";

export const dynamic = "force-dynamic";

/** CSV of the Activity list for the current filters (first CSV_ROW_LIMIT rows, newest first). */
export async function GET(req: NextRequest) {
  await requireUser();
  const filters = activityFiltersSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  try {
    const timeZone = await getTimeZone();
    const { items } = await listDeliveries({ ...filters, page: 1 }, CSV_ROW_LIMIT);
    const csv = toCsv([
      [
        `time (${timeZone})`,
        "commenter",
        "comment",
        "campaign",
        "rule",
        "keyword",
        "status",
        "skip_reason",
        "public_reply",
        "dm",
        "error_code",
        "error",
        "comment_id",
        "media_id",
      ],
      ...items.map((d) => [
        formatCsvDateTime(d.createdAt, timeZone),
        d.commenterUsername,
        d.commentText,
        d.campaignName,
        d.ruleName,
        d.matchedKeyword,
        d.status,
        d.skipReason,
        d.publicReplyStatus,
        d.dmStatus,
        d.errorCode,
        d.error,
        d.commentId,
        d.mediaId,
      ]),
    ]);
    const filename = `${appSlug()}-activity-${ymdInZone(new Date(), timeZone)}.csv`;
    return new NextResponse(csv, { headers: csvHeaders(filename) });
  } catch (err) {
    logger("activity").error("export.failed", { err });
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
