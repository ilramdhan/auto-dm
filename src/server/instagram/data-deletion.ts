import "server-only";
import { eq, or, sql, type SQL } from "drizzle-orm";
import {
  CONFIRMATION_CODE_BYTES,
  type DataDeletionStatus,
  type DeleteCommenterDataInput,
} from "@/lib/validation/data-deletion";
import { randomToken } from "@/server/crypto";
import { db } from "@/server/db/client";
import { dataDeletionRequests, deliveries, instagramAccounts } from "@/server/db/schema";
import { getSetting } from "@/server/settings";
import { readRawBody } from "./inbound";
import { parseSignedRequest, type SignedRequest } from "./signed-request";

/** Wiped account fields. The row itself is kept so campaigns (FK) survive a reconnect. */
const DISCONNECTED = { isActive: false, accessTokenEnc: "", tokenExpiresAt: null } as const;

export type SignedRequestResult =
  | { ok: true; request: SignedRequest }
  | { ok: false; reason: "body_too_large" | "missing_field" | "not_configured" | "invalid_signed_request" };

/**
 * Reads the `application/x-www-form-urlencoded` body Meta posts to the deauthorize and data deletion
 * callbacks and verifies its `signed_request` with `meta.appSecret`. The reason is safe to log; the
 * signed request itself never is.
 */
export async function readSignedRequest(req: Request): Promise<SignedRequestResult> {
  const raw = await readRawBody(req);
  if (raw === null) return { ok: false, reason: "body_too_large" };
  const signed = new URLSearchParams(raw).get("signed_request");
  if (!signed) return { ok: false, reason: "missing_field" };
  const appSecret = await getSetting("meta.appSecret");
  if (!appSecret) return { ok: false, reason: "not_configured" };
  const request = parseSignedRequest(signed, appSecret);
  return request ? { ok: true, request } : { ok: false, reason: "invalid_signed_request" };
}

/**
 * The user removed the app from their Instagram settings: if it's the connected account, wipe its
 * token and mark it inactive (no Graph call — the token is already revoked). Returns whether an
 * account matched.
 */
export async function deauthorizeUser(igUserId: string): Promise<boolean> {
  const rows = await db
    .update(instagramAccounts)
    .set(DISCONNECTED)
    .where(eq(instagramAccounts.igUserId, igUserId))
    .returning({ id: instagramAccounts.id });
  return rows.length > 0;
}

export interface DeleteUserDataResult {
  confirmationCode: string;
  status: DataDeletionStatus;
  deletedDeliveries: number;
  accountWiped: boolean;
}

/**
 * Deletes everything stored about an Instagram user (Meta data deletion callback), in one
 * transaction:
 * - deliveries they commented (`commenter_id`) or received on their own account (`ig_user_id`);
 * - if it's a connected account: token, profile fields and active flag are wiped (row kept for FKs);
 * - a `data_deletion_requests` row with a new confirmation code is recorded.
 */
export async function deleteUserData(igUserId: string): Promise<DeleteUserDataResult> {
  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(deliveries)
      .where(or(eq(deliveries.igUserId, igUserId), eq(deliveries.commenterId, igUserId)))
      .returning({ id: deliveries.id });
    const accounts = await tx
      .update(instagramAccounts)
      .set({
        ...DISCONNECTED,
        tokenRefreshedAt: null,
        username: "deleted",
        name: null,
        profilePictureUrl: null,
      })
      .where(eq(instagramAccounts.igUserId, igUserId))
      .returning({ id: instagramAccounts.id });
    const receipt = await recordDeletionRequest(tx, igUserId, deleted.length > 0 || accounts.length > 0);
    return { ...receipt, deletedDeliveries: deleted.length, accountWiped: accounts.length > 0 };
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Records a completed deletion request with a fresh confirmation code (shared by every deletion path). */
async function recordDeletionRequest(
  tx: Tx,
  igUserId: string | null,
  deletedSomething: boolean,
): Promise<{ confirmationCode: string; status: DataDeletionStatus }> {
  const confirmationCode = randomToken(CONFIRMATION_CODE_BYTES);
  const status: DataDeletionStatus = deletedSomething ? "completed" : "no_data";
  await tx
    .insert(dataDeletionRequests)
    .values({ confirmationCode, igUserId, status, completedAt: new Date() });
  return { confirmationCode, status };
}

export interface DeleteCommenterDataResult {
  confirmationCode: string;
  status: DataDeletionStatus;
  /** Number of `deliveries` rows deleted. */
  deleted: number;
}

/**
 * Operator-initiated deletion for a commenter who asked by email (commenters never log in, so Meta
 * sends no callback for them). In one transaction, deletes every delivery whose `commenter_id`
 * matches exactly or whose `commenter_username` matches case-insensitively (leading "@" ignored),
 * and records a `data_deletion_requests` row. Never touches `instagram_accounts`.
 */
export async function deleteCommenterData(
  input: DeleteCommenterDataInput,
): Promise<DeleteCommenterDataResult> {
  const commenterId = input.commenterId?.trim() || undefined;
  const username = input.username?.trim().replace(/^@/, "").toLowerCase() || undefined;
  const conditions: SQL[] = [];
  if (commenterId) conditions.push(eq(deliveries.commenterId, commenterId));
  if (username) conditions.push(sql`lower(${deliveries.commenterUsername}) = ${username}`);
  if (conditions.length === 0) throw new Error("deleteCommenterData needs a commenterId or username");
  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(deliveries)
      .where(or(...conditions))
      .returning({ id: deliveries.id });
    const receipt = await recordDeletionRequest(tx, commenterId ?? null, deleted.length > 0);
    return { ...receipt, deleted: deleted.length };
  });
}

export interface DeletionRequestStatus {
  status: DataDeletionStatus;
  createdAt: Date;
  completedAt: Date | null;
}

/** Public status lookup for /data-deletion?code=... (exposes no user ids). */
export async function getDeletionRequest(confirmationCode: string): Promise<DeletionRequestStatus | null> {
  const [row] = await db
    .select({
      status: dataDeletionRequests.status,
      createdAt: dataDeletionRequests.createdAt,
      completedAt: dataDeletionRequests.completedAt,
    })
    .from(dataDeletionRequests)
    .where(eq(dataDeletionRequests.confirmationCode, confirmationCode))
    .limit(1);
  return row ?? null;
}
