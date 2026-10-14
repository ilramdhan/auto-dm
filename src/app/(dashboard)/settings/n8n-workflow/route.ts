import { NextResponse } from "next/server";
import { appUrl } from "@/env";
import { requireUser } from "@/server/auth/guard";
import { buildN8nWorkflow } from "@/server/n8n/workflow";

export const dynamic = "force-dynamic";

/** Downloads the n8n relay workflow pre-filled with this deployment's URL. */
export async function GET() {
  await requireUser();
  const workflow = buildN8nWorkflow({ appUrl: appUrl() });
  return new NextResponse(JSON.stringify(workflow, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="auto-reply-ig.n8n.json"',
      "Cache-Control": "no-store",
    },
  });
}
