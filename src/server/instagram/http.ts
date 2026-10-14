import "server-only";
import { AppError, isAppError } from "@/server/errors";
import type { Logger } from "@/server/log";
import { GraphApiError } from "./graph";

/** Common no-cache headers for API responses. */
export function noStore(contentType?: string): HeadersInit {
  return {
    "Cache-Control": "no-store",
    ...(contentType ? { "Content-Type": `${contentType}; charset=utf-8` } : {}),
  };
}

/** JSON error body used by every API route: `{ error: { code, message } }`. */
export function errorJson(err: AppError): Response {
  return Response.json(
    { error: { code: err.code, message: err.publicMessage } },
    { status: err.status, headers: noStore() },
  );
}

/**
 * Maps any thrown value to an HTTP response: AppError → its code/status, GraphApiError → UPSTREAM
 * (502), anything else is logged and returned as a generic 500.
 */
export function errorResponse(err: unknown, log: Logger, event = "request.failed"): Response {
  if (isAppError(err)) return errorJson(err);
  if (err instanceof GraphApiError) {
    log.warn(event, { err: err.toSafeString() });
    return errorJson(err.toAppError());
  }
  log.error(event, { err });
  return errorJson(new AppError("INTERNAL", "Something went wrong"));
}
