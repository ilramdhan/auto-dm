import "server-only";

import template from "../../../n8n/auto-reply-ig.workflow.json";

/** Placeholder in the template's Config node that is replaced with the app URL. */
export const APP_URL_PLACEHOLDER = "__APP_URL__";

/**
 * Returns the importable n8n workflow with `appUrl` pre-filled in the Config node.
 * Always a deep copy; the credential (API key) is never embedded.
 */
export function buildN8nWorkflow({ appUrl }: { appUrl: string }): Record<string, unknown> {
  const url = appUrl.trim().replace(/\/+$/, "");
  const json = JSON.stringify(template).split(APP_URL_PLACEHOLDER).join(url.replace(/["\\]/g, ""));
  return JSON.parse(json) as Record<string, unknown>;
}
