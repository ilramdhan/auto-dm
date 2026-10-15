import { z } from "zod";

/** Bytes of randomness in a confirmation code (base64url → 24 characters). */
export const CONFIRMATION_CODE_BYTES = 18;

/** Confirmation code returned to Meta and shown on /data-deletion?code=... */
export const confirmationCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{24}$/, "Invalid confirmation code");

export const DATA_DELETION_STATUSES = ["completed", "no_data"] as const;
export type DataDeletionStatus = (typeof DATA_DELETION_STATUSES)[number];
