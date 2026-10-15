import type { Instrumentation } from "next";

/** Nothing to initialise; present so Next loads this file and calls `onRequestError`. */
export function register() {}

/**
 * Logs every unhandled server error (render, route handler, server action) as one structured line.
 * `digest` is the "Reference" shown on the error page, so a user report can be matched to a log line.
 * Never logs headers, query strings or bodies.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { logger } = await import("@/server/log");
  const digest = (err as { digest?: unknown } | null)?.digest;
  logger("app").error("request.unhandled_error", {
    errorName: err instanceof Error ? err.name : typeof err,
    err,
    digest: typeof digest === "string" ? digest : undefined,
    path: request.path.split("?")[0],
    method: request.method,
    routerKind: context.routerKind,
    routeType: context.routeType,
    routePath: context.routePath,
    renderSource: context.renderSource,
  });
};
