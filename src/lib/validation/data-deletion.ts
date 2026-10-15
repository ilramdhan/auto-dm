import { z } from "zod";

/** Bytes of randomness in a confirmation code (base64url → 24 characters). */
export const CONFIRMATION_CODE_BYTES = 18;

/** Confirmation code returned to Meta and shown on /data-deletion?code=... */
export const confirmationCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{24}$/, "Invalid confirmation code");

export const DATA_DELETION_STATUSES = ["completed", "no_data"] as const;
export type DataDeletionStatus = (typeof DATA_DELETION_STATUSES)[number];

/** Instagram username: 1-30 letters, digits, "." or "_"; a leading "@" is accepted and stripped. */
export const igUsernameSchema = z
  .string()
  .trim()
  .min(1, "Enter an Instagram username")
  .regex(/^@?[A-Za-z0-9._]{1,30}$/, "Use 1-30 letters, numbers, dots or underscores")
  .transform((v) => v.replace(/^@/, ""));

/** Instagram-scoped commenter id as stored in `deliveries.commenter_id`. */
export const commenterIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{1,64}$/, "Invalid commenter id");

/** Operator-initiated deletion of a commenter's data (email request): by id, username, or both. */
export const deleteCommenterDataSchema = z
  .object({
    commenterId: commenterIdSchema.optional(),
    username: igUsernameSchema.optional(),
  })
  .refine((v) => v.commenterId !== undefined || v.username !== undefined, {
    message: "Enter an Instagram username",
    path: ["username"],
  });
export type DeleteCommenterDataInput = z.output<typeof deleteCommenterDataSchema>;
