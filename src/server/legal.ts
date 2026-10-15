import "server-only";
import { envProblems } from "@/env";
import { getDeletionRequest, type DeletionRequestStatus } from "./instagram/data-deletion";
import { logger } from "./log";
import { getPublicContact, type PublicContact } from "./settings";

const log = logger("legal");
const EMPTY: PublicContact = { operatorName: null, contactEmail: null };

/**
 * Operator name + contact email for the public /privacy and /data-deletion pages. Never throws:
 * on a fresh deploy (env not configured) or a DB error the pages fall back to generic wording.
 */
export async function loadPublicContact(): Promise<PublicContact> {
  if (envProblems().length > 0) return EMPTY;
  try {
    return await getPublicContact();
  } catch (err) {
    log.warn("public_contact.unavailable", { err: err instanceof Error ? err.name : "unknown" });
    return EMPTY;
  }
}

export type DeletionLookup =
  { kind: "found"; request: DeletionRequestStatus } | { kind: "not_found" } | { kind: "unavailable" };

/** Status of a data deletion request by (already validated) confirmation code. Never throws. */
export async function lookupDeletionRequest(code: string): Promise<DeletionLookup> {
  if (envProblems().length > 0) return { kind: "unavailable" };
  try {
    const request = await getDeletionRequest(code);
    return request ? { kind: "found", request } : { kind: "not_found" };
  } catch (err) {
    log.warn("deletion_lookup.unavailable", { err: err instanceof Error ? err.name : "unknown" });
    return { kind: "unavailable" };
  }
}
