import "server-only";
import { z } from "zod";
import { truncateText } from "@/server/engine/template";
import { BUTTON_TEMPLATE_TEXT_MAX, BUTTON_TITLE_MAX, COMMENT_MAX_CHARS, DM_MAX_CHARS } from "./constants";
import { GraphApiError, graphId, graphRequest } from "./graph";

const replySchema = z.object({ id: graphId });
const messageSchema = z.object({ recipient_id: graphId.optional(), message_id: z.string().min(1) });

/**
 * Publicly replies to a comment (`POST /{comment-id}/replies`, form field `message`).
 * Not retried on 5xx/timeouts to avoid double replies.
 */
export async function replyToComment(
  accessToken: string,
  commentId: string,
  message: string,
): Promise<{ id: string }> {
  return graphRequest({
    method: "POST",
    path: `/${encodeURIComponent(commentId)}/replies`,
    accessToken,
    form: { message: truncateText(message, COMMENT_MAX_CHARS) },
    schema: replySchema,
  });
}

export interface PrivateReplyInput {
  accessToken: string;
  /** Our Instagram professional account id (`user_id` from /me). */
  igUserId: string;
  commentId: string;
  text: string;
  button?: { title: string; url: string } | null;
}

export interface PrivateReplyResult {
  messageId: string;
  /** "button" when sent as a button template, "text" otherwise. */
  format: "button" | "text";
  /** Set when a button template was rejected and the DM was re-sent as text + link. */
  templateFallback?: { code: number | undefined; message: string };
}

/** Appends the button URL to the text, keeping the total within {@link DM_MAX_CHARS}. */
export function textWithLink(text: string, button: { title: string; url: string }): string {
  const suffix = `\n\n${button.title}: ${button.url}`;
  const room = DM_MAX_CHARS - Array.from(suffix).length;
  if (room < 1) return truncateText(text, DM_MAX_CHARS);
  return `${truncateText(text, room)}${suffix}`;
}

/**
 * A 4xx Graph error that is not about auth or throttling — i.e. Instagram rejected the message
 * format (e.g. `(#100) Invalid parameter` for an unsupported template). Retried once as text.
 */
function isTemplateRejection(err: unknown): err is GraphApiError {
  return (
    err instanceof GraphApiError &&
    err.status >= 400 &&
    err.status < 500 &&
    !err.isAuthError &&
    !err.isRateLimit
  );
}

async function sendMessage(accessToken: string, igUserId: string, commentId: string, message: unknown) {
  return graphRequest({
    method: "POST",
    path: `/${encodeURIComponent(igUserId)}/messages`,
    accessToken,
    json: { recipient: { comment_id: commentId }, message },
    schema: messageSchema,
  });
}

/**
 * Sends a Private Reply (one DM per comment, within 7 days) via
 * `POST /{ig-user-id}/messages` with `recipient: { comment_id }`.
 *
 * With a button configured we first try a button template (`attachment.type = template`,
 * `template_type = button`, one `web_url` button). If Instagram rejects it with a 400-class error,
 * we fall back to plain text with the link appended, so the DM is still delivered.
 */
export async function sendPrivateReply(input: PrivateReplyInput): Promise<PrivateReplyResult> {
  const { accessToken, igUserId, commentId, button } = input;
  const text = truncateText(input.text, DM_MAX_CHARS);

  if (button && button.url && button.title) {
    const textChars = Array.from(text).length;
    if (textChars > 0 && textChars <= BUTTON_TEMPLATE_TEXT_MAX) {
      try {
        const res = await sendMessage(accessToken, igUserId, commentId, {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text,
              buttons: [
                { type: "web_url", url: button.url, title: truncateText(button.title, BUTTON_TITLE_MAX) },
              ],
            },
          },
        });
        return { messageId: res.message_id, format: "button" };
      } catch (err) {
        if (!isTemplateRejection(err)) throw err;
        const res = await sendMessage(accessToken, igUserId, commentId, { text: textWithLink(text, button) });
        return {
          messageId: res.message_id,
          format: "text",
          templateFallback: { code: err.code, message: err.message },
        };
      }
    }
    const res = await sendMessage(accessToken, igUserId, commentId, { text: textWithLink(text, button) });
    return { messageId: res.message_id, format: "text" };
  }

  const res = await sendMessage(accessToken, igUserId, commentId, { text });
  return { messageId: res.message_id, format: "text" };
}
