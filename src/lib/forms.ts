import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/**
 * Applies `{ fieldErrors }` from a failed server action to a react-hook-form instance and toasts
 * the general message. Returns true when the result was ok.
 */
export function handleActionResult<T extends FieldValues, D>(
  res: ActionResult<D>,
  setError?: UseFormSetError<T>,
  prefix = "",
): res is Extract<ActionResult<D>, { ok: true }> {
  if (res.ok) return true;
  let applied = false;
  if (setError && res.fieldErrors) {
    for (const [key, messages] of Object.entries(res.fieldErrors)) {
      if (!messages?.length || key === "_form") continue;
      const name = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
      setError(name as Path<T>, { type: "server", message: messages[0] });
      applied = true;
    }
  }
  toast.error(applied ? "Please fix the highlighted fields." : res.error);
  return false;
}
