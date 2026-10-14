import type { z } from "zod";
import type { ActionResult } from "@/server/errors";

/**
 * Isomorphic helpers around the shared `ActionResult` type (defined in server/errors.ts;
 * type-only import, so nothing server-only reaches the client bundle).
 */
export type { ActionResult };
export type FieldErrors = Record<string, string[]>;
export type Failure = Extract<ActionResult, { ok: false }>;

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: FieldErrors): Failure {
  return { ok: false, error, ...(fieldErrors ? { code: "VALIDATION" as const, fieldErrors } : {}) };
}

/** ZodError → `{ ok:false, fieldErrors }` keyed by dotted path ("publicReplies.0"). */
export function zodFailure(err: z.ZodError, message = "Please fix the highlighted fields."): Failure {
  const fieldErrors: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail(message, fieldErrors);
}
