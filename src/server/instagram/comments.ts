import "server-only";
import { z } from "zod";
import { graphId, graphRequest } from "./graph";

/**
 * Reading a post's comments (`GET /{ig-media-id}/comments`, Instagram API with Instagram Login) for
 * "Check post for missed comments". Meta returns top-level comments newest first (API v3.2+), at
 * most 50 per page, and can't filter by time; replies are only included through the `replies`
 * field expansion, which we request inline (first page of replies per comment, no extra calls).
 */

/** Comments per page (Meta's maximum). */
export const COMMENTS_PAGE_LIMIT = 50;
/** Pages read per post, at most (so 250 top-level comments). */
export const COMMENTS_MAX_PAGES = 5;

const COMMENT_FIELDS = "id,text,timestamp,username,from{id,username},parent_id";
export const COMMENTS_FIELDS = `${COMMENT_FIELDS},replies{${COMMENT_FIELDS}}`;

const commentSchema = z.object({
  id: graphId,
  text: z.string().optional(),
  timestamp: z.string().optional(),
  username: z.string().optional(),
  from: z.object({ id: graphId.optional(), username: z.string().optional() }).optional(),
  parent_id: graphId.optional(),
});

const pagingSchema = z
  .object({
    cursors: z.object({ after: z.string().optional() }).optional(),
    next: z.string().optional(),
  })
  .optional();

export const commentsPageSchema = z.object({
  data: z.array(
    commentSchema.extend({
      replies: z.object({ data: z.array(commentSchema) }).optional(),
    }),
  ),
  paging: pagingSchema,
});
export type CommentsPage = z.infer<typeof commentsPageSchema>;

/** A comment read from Instagram, flattened (replies carry `parentId`). */
export interface FetchedComment {
  commentId: string;
  mediaId: string;
  text: string;
  createdAt: Date;
  fromId: string;
  fromUsername: string | null;
  parentId: string | null;
}

function parseTimestamp(raw: string | undefined): Date | null {
  if (!raw) return null;
  // Meta sends "2026-10-19T03:20:00+0000"; normalise the offset for strict parsers.
  const d = new Date(raw.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Flattens one page into comments created at or after `since`, replies included. Comments without
 * a commenter id or a valid timestamp are dropped (they can't be checked for once-per-user or for
 * the 7-day window). Pure.
 */
export function flattenCommentsPage(
  page: CommentsPage,
  opts: { mediaId: string; since: Date },
): FetchedComment[] {
  const out: FetchedComment[] = [];
  const add = (c: z.infer<typeof commentSchema>, parentId: string | null) => {
    const createdAt = parseTimestamp(c.timestamp);
    const fromId = c.from?.id;
    if (!createdAt || !fromId || createdAt < opts.since) return;
    out.push({
      commentId: c.id,
      mediaId: opts.mediaId,
      text: c.text ?? "",
      createdAt,
      fromId,
      fromUsername: c.from?.username ?? c.username ?? null,
      parentId: c.parent_id ?? parentId,
    });
  };
  for (const c of page.data) {
    add(c, null);
    for (const r of c.replies?.data ?? []) add(r, c.id);
  }
  return out;
}

/**
 * Next page cursor, or `null` when there is none or the page already reached comments older than
 * `since` (top-level comments are newest first, so older pages can't hold newer top-level comments).
 * Pure.
 */
export function nextCommentsCursor(page: CommentsPage, since: Date): string | null {
  if (!page.paging?.next) return null;
  const last = page.data.at(-1);
  const lastAt = parseTimestamp(last?.timestamp);
  if (lastAt && lastAt < since) return null;
  return page.paging.cursors?.after ?? null;
}

/**
 * Reads up to `maxPages` pages of a post's comments posted since `since`. Follows the `after`
 * cursor on our own fixed URL (never the `paging.next` URL from the response). Throws
 * `GraphApiError` on failure (retry/redaction handled by `graphRequest`).
 */
export async function fetchRecentComments(params: {
  accessToken: string;
  mediaId: string;
  since: Date;
  maxPages?: number;
}): Promise<{ comments: FetchedComment[]; pages: number; truncated: boolean }> {
  const maxPages = Math.max(1, params.maxPages ?? COMMENTS_MAX_PAGES);
  const comments: FetchedComment[] = [];
  let after: string | null = null;
  let pages = 0;
  for (;;) {
    const page: CommentsPage = await graphRequest({
      path: `/${encodeURIComponent(params.mediaId)}/comments`,
      accessToken: params.accessToken,
      query: { fields: COMMENTS_FIELDS, limit: COMMENTS_PAGE_LIMIT, after: after ?? undefined },
      schema: commentsPageSchema,
    });
    pages++;
    comments.push(...flattenCommentsPage(page, { mediaId: params.mediaId, since: params.since }));
    after = nextCommentsCursor(page, params.since);
    if (!after) return { comments, pages, truncated: false };
    if (pages >= maxPages) return { comments, pages, truncated: true };
  }
}
