import "server-only";

/**
 * Application error with a stable machine code and a user-safe message.
 * Route handlers / server actions map AppError -> HTTP status or `{ ok: false, error }`;
 * anything else is logged and returned as a generic "Something went wrong".
 */
export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "UPSTREAM"
  | "INTERNAL";

const STATUS: Record<AppErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  NOT_CONFIGURED: 412,
  UPSTREAM: 502,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Safe to show to the admin user. */
  readonly publicMessage: string;
  constructor(code: AppErrorCode, publicMessage: string, options?: { cause?: unknown }) {
    super(publicMessage, options);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.publicMessage = publicMessage;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/** Shape returned by server actions. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: AppErrorCode; fieldErrors?: Record<string, string[]> };
