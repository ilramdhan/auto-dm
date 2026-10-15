import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/env";
import { deleteUserData, readSignedRequest } from "@/server/instagram/data-deletion";
import { noStore } from "@/server/instagram/http";
import { logger } from "@/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = logger("data-deletion");

/**
 * Meta "Data deletion request URL": called with a `signed_request` when a user asks for their data
 * to be deleted. Deletes it right away and answers with Meta's expected `{ url, confirmation_code }`;
 * the URL shows the request's status.
 */
export async function POST(req: NextRequest) {
  try {
    const result = await readSignedRequest(req);
    if (!result.ok) {
      log.warn("data_deletion.rejected", { reason: result.reason });
      return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: noStore() });
    }
    const { confirmationCode, status, deletedDeliveries, accountWiped } = await deleteUserData(
      result.request.userId,
    );
    log.info("data_deletion.processed", { status, deletedDeliveries, accountWiped });
    return NextResponse.json(
      {
        url: `${appUrl()}/data-deletion?code=${encodeURIComponent(confirmationCode)}`,
        confirmation_code: confirmationCode,
      },
      { headers: noStore() },
    );
  } catch (err) {
    log.error("data_deletion.failed", { err: err instanceof Error ? err.name : "unknown" });
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers: noStore() });
  }
}
