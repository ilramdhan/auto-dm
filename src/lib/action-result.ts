import { z } from "zod";

/** Uniform server-action result shared by every form. */
export type ActionResult<T = undefined> =
  | ({ ok: true; message?: string } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export type FieldErrors = Record<string, string[] | undefined>;

export function ok(message?: string): ActionResult {
  return { ok: true, message };
}

export function okWith<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, message, data } as ActionResult<T>;
}

export function fail(error: string, fieldErrors?: FieldErrors): { ok: false; error: string; fieldErrors?: FieldErrors } {
  return { ok: false, error, fieldErrors };
}

/** Turn a ZodError into `{ ok:false, fieldErrors }` keyed by dotted path. */
export function fromZodError(err: z.ZodError, message = "Please fix the highlighted fields.") {
  const fieldErrors: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail(message, fieldErrors);
}
