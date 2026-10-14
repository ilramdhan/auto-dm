import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { fail, zodFailure } from "@/lib/action-result";
import { requireUser } from "@/server/auth/guard";
import { isAppError, type ActionResult } from "@/server/errors";
import { logger } from "@/server/log";

type User = { id: string; username: string };

/**
 * Runs `fn` and maps errors to a user-safe ActionResult:
 * - Next control flow (redirect/notFound) is re-thrown untouched
 * - AppError → its public message + code
 * - anything else → logged, generic message
 */
export async function runAction<T>(
  scope: string,
  name: string,
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) {
      logger(scope).warn(`${name}.app_error`, { code: err.code, message: err.publicMessage });
      return { ok: false, error: err.publicMessage, code: err.code };
    }
    logger(scope).error(`${name}.failed`, { err });
    return fail("Something went wrong. Please try again.");
  }
}

/**
 * Defines an authenticated server action: `requireUser()` → Zod-parse input → handler.
 *
 *   export const saveThing = authedAction("campaigns", "save", schema, async (input, user) => ok(...));
 */
export function authedAction<S extends z.ZodType, T>(
  scope: string,
  name: string,
  schema: S,
  handler: (input: z.output<S>, user: User) => Promise<ActionResult<T>>,
): (input: z.input<S>) => Promise<ActionResult<T>> {
  return async (input) => {
    const user = await requireUser();
    return runAction(scope, name, async () => {
      const parsed = schema.safeParse(input);
      if (!parsed.success) return zodFailure(parsed.error);
      return handler(parsed.data, user);
    });
  };
}

/** Converts FormData to a plain object (repeated keys → arrays, "on" checkboxes → true). */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string") continue;
    const val: unknown = v;
    if (k in out) out[k] = ([] as unknown[]).concat(out[k], val);
    else out[k] = val;
  }
  return out;
}
