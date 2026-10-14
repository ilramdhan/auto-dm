import "server-only";
import { z } from "zod";
import { AppError } from "@/server/errors";
import { logger } from "@/server/log";
import { GRAPH_BASE_URL } from "./constants";

const log = logger("graph");

/* --------------------------------- errors --------------------------------- */

/** Error returned by (or while calling) the Instagram Graph API. Never contains tokens. */
export class GraphApiError extends Error {
  override readonly name = "GraphApiError";
  /** HTTP status (0 = network error / timeout / unparseable response). */
  readonly status: number;
  readonly code: number | undefined;
  readonly subcode: number | undefined;
  readonly type: string | undefined;
  readonly fbtraceId: string | undefined;

  constructor(
    message: string,
    opts: { status: number; code?: number; subcode?: number; type?: string; fbtraceId?: string },
  ) {
    super(message);
    this.status = opts.status;
    this.code = opts.code;
    this.subcode = opts.subcode;
    this.type = opts.type;
    this.fbtraceId = opts.fbtraceId;
  }

  /** Token invalid/expired/revoked (OAuthException code 190) or permission error. */
  get isAuthError(): boolean {
    return this.code === 190 || this.code === 102 || this.status === 401;
  }

  /** App/user/business-level throttling. */
  get isRateLimit(): boolean {
    return this.status === 429 || [4, 17, 32, 613].includes(this.code ?? -1);
  }

  /** Maps to the app-wide error type (`UPSTREAM`, 502) for route handlers. */
  toAppError(publicMessage = "Instagram API request failed"): AppError {
    return new AppError("UPSTREAM", publicMessage, { cause: this });
  }

  /** Short, log-safe description, e.g. `(#100) Invalid parameter [code=100 subcode=33 trace=Ab12]`. */
  toSafeString(): string {
    const meta = [
      this.code !== undefined ? `code=${this.code}` : null,
      this.subcode !== undefined ? `subcode=${this.subcode}` : null,
      this.fbtraceId ? `trace=${this.fbtraceId}` : null,
    ].filter(Boolean);
    return meta.length ? `${this.message} [${meta.join(" ")}]` : this.message;
  }
}

/** Graph API error envelope: `{ error: { message, type, code, error_subcode, fbtrace_id } }`. */
const graphErrorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    error_user_msg: z.string().optional(),
    fbtrace_id: z.string().optional(),
  }),
});

/** api.instagram.com OAuth error envelope: `{ error_type, code, error_message }`. */
const oauthErrorSchema = z.object({
  error_type: z.string().optional(),
  code: z.number().optional(),
  error_message: z.string().optional(),
});

function errorFromBody(status: number, body: unknown): GraphApiError {
  const g = graphErrorSchema.safeParse(body);
  if (g.success) {
    const e = g.data.error;
    return new GraphApiError(e.message ?? e.error_user_msg ?? `Instagram API error (HTTP ${status})`, {
      status,
      code: e.code,
      subcode: e.error_subcode,
      type: e.type,
      fbtraceId: e.fbtrace_id,
    });
  }
  const o = oauthErrorSchema.safeParse(body);
  if (o.success && (o.data.error_message || o.data.error_type)) {
    return new GraphApiError(o.data.error_message ?? o.data.error_type ?? "OAuth error", {
      status,
      code: o.data.code,
      type: o.data.error_type,
    });
  }
  return new GraphApiError(`Instagram API error (HTTP ${status})`, { status });
}

/* --------------------------------- request -------------------------------- */

type QueryValue = string | number | boolean | undefined | null;

export interface GraphRequestOptions<T> {
  method?: "GET" | "POST" | "DELETE";
  /** Path relative to the versioned Graph base (e.g. `/me/media`) or an absolute https URL. */
  path: string;
  /** Sent as the `access_token` query parameter (documented for every IG Login endpoint). */
  accessToken?: string;
  query?: Record<string, QueryValue>;
  /** application/x-www-form-urlencoded body. */
  form?: Record<string, QueryValue>;
  /** JSON body. Mutually exclusive with `form`. */
  json?: unknown;
  /** Response schema; the parsed value is returned. */
  schema: z.ZodType<T>;
  /** Per-attempt timeout. Default 10s. */
  timeoutMs?: number;
  /** Retries after the first attempt. Default 2. */
  retries?: number;
  /**
   * Whether the call may be repeated after a 5xx / network failure. Defaults to true for GET and
   * false otherwise (a POST that timed out may have been applied, e.g. a public comment reply).
   * 429 responses are always retried: the request was rejected before being processed.
   */
  idempotent?: boolean;
}

const RETRY_BASE_MS = 400;
const RETRY_MAX_MS = 5_000;

function buildUrl(
  path: string,
  query: Record<string, QueryValue> | undefined,
  token: string | undefined,
): URL {
  const url = /^https:\/\//.test(path)
    ? new URL(path)
    : new URL(GRAPH_BASE_URL + (path.startsWith("/") ? path : `/${path}`));
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  if (token) url.searchParams.set("access_token", token);
  return url;
}

function toForm(form: Record<string, QueryValue>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(form)) if (v !== undefined && v !== null) body.set(k, String(v));
  return body;
}

function backoffMs(attempt: number, retryAfter: string | null): number {
  const ra = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(ra) && ra >= 0) return Math.min(ra * 1000, RETRY_MAX_MS);
  const exp = RETRY_BASE_MS * 2 ** attempt;
  return Math.min(exp + Math.floor(Math.random() * RETRY_BASE_MS), RETRY_MAX_MS);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Typed request to the Instagram Graph API with timeout, bounded retry and Zod validation.
 * Throws {@link GraphApiError} on any failure. Tokens/secrets are only placed in the URL/body and
 * never appear in thrown messages.
 */
export async function graphRequest<T>(opts: GraphRequestOptions<T>): Promise<T> {
  const method = opts.method ?? "GET";
  const retries = Math.max(0, opts.retries ?? 2);
  const idempotent = opts.idempotent ?? method === "GET";
  const url = buildUrl(opts.path, opts.query, opts.accessToken);
  // Log-safe identifier: path only, never the query string (it carries the token/secret).
  const logPath = /^https:\/\//.test(opts.path) ? new URL(opts.path).pathname : opts.path;
  const fail = (err: GraphApiError, attempts: number): GraphApiError => {
    log.warn("graph.request_failed", {
      method,
      path: logPath,
      attempts,
      httpStatus: err.status,
      code: err.code,
      subcode: err.subcode,
      fbtraceId: err.fbtraceId,
      message: err.message,
    });
    return err;
  };

  let body: BodyInit | undefined;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.form) {
    body = toForm(opts.form);
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (opts.json !== undefined) {
    body = JSON.stringify(opts.json);
    headers["Content-Type"] = "application/json";
  }

  for (let attempt = 0; ; attempt++) {
    const canRetry = attempt < retries;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
        cache: "no-store",
      });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      if (canRetry && idempotent) {
        await sleep(backoffMs(attempt, null));
        continue;
      }
      throw fail(
        new GraphApiError(
          timedOut ? "Instagram API request timed out" : "Network error calling Instagram API",
          { status: 0 },
        ),
        attempt + 1,
      );
    }

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = undefined;
    }

    if (!res.ok) {
      const retryable = res.status === 429 || (res.status >= 500 && idempotent);
      if (canRetry && retryable) {
        await sleep(backoffMs(attempt, res.headers.get("retry-after")));
        continue;
      }
      throw fail(errorFromBody(res.status, parsed), attempt + 1);
    }

    if (parsed === undefined) {
      throw fail(
        new GraphApiError("Instagram API returned a non-JSON response", { status: res.status }),
        attempt + 1,
      );
    }
    // Some endpoints answer HTTP 200 with an error envelope.
    if (graphErrorSchema.safeParse(parsed).success)
      throw fail(errorFromBody(res.status, parsed), attempt + 1);

    const result = opts.schema.safeParse(parsed);
    if (!result.success) {
      throw fail(
        new GraphApiError("Unexpected Instagram API response shape", { status: res.status }),
        attempt + 1,
      );
    }
    return result.data;
  }
}

/** Instagram ids are strings, but tolerate numeric ids (coerced to string). */
export const graphId = z.union([z.string().min(1), z.number().int()]).transform(String);

/**
 * Turn any error into a short, log-/DB-safe message. Removes anything that looks like a token or
 * secret passed in `secrets`, and truncates to `max` chars.
 */
export function safeErrorMessage(
  err: unknown,
  secrets: readonly (string | undefined)[] = [],
  max = 500,
): string {
  let msg =
    err instanceof GraphApiError ? err.toSafeString() : err instanceof Error ? err.message : "Unknown error";
  for (const s of secrets) if (s && s.length >= 8) msg = msg.split(s).join("[redacted]");
  // Long opaque strings in error text (e.g. echoed tokens) are redacted defensively.
  msg = msg.replace(/\b(IG|EA|IGQ)[A-Za-z0-9_-]{40,}\b/g, "[redacted]");
  msg = msg.replace(/access_token=[^&\s]+/gi, "access_token=[redacted]");
  return msg.length > max ? `${msg.slice(0, max - 1)}…` : msg;
}
