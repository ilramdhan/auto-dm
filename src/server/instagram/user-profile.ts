import "server-only";
import { z } from "zod";
import { graphRequest } from "./graph";

const followStatusSchema = z.object({ is_user_follow_business: z.boolean() });

/**
 * Whether the Instagram user `igsid` follows our professional account, via the User Profile API
 * (`GET /{igsid}?fields=is_user_follow_business`). Only works for users who have messaged us or
 * opened the conversation (e.g. tapped a postback button). Throws {@link GraphApiError} on failure
 * or when the field is missing; GET is retried on 429/5xx.
 */
export async function getUserFollowStatus(accessToken: string, igsid: string): Promise<boolean> {
  const res = await graphRequest({
    path: `/${encodeURIComponent(igsid)}`,
    accessToken,
    query: { fields: "is_user_follow_business" },
    schema: followStatusSchema,
  });
  return res.is_user_follow_business;
}
