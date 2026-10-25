/**
 * Follow gate postback payload: `fg:<deliveryId>`. Isomorphic and pure (no `server-only`) so it
 * can be unit tested.
 */
import { z } from "zod";
import { FOLLOW_GATE_PAYLOAD_PREFIX } from "@/lib/constants";

/** Payload of the "I've followed" postback button for a delivery. */
export function followGatePayload(deliveryId: string): string {
  return `${FOLLOW_GATE_PAYLOAD_PREFIX}${deliveryId}`;
}

const deliveryIdSchema = z.uuid();

/** The delivery id in a follow gate payload, or `null` when it isn't one of ours. */
export function parseFollowGatePayload(payload: string): string | null {
  if (!payload.startsWith(FOLLOW_GATE_PAYLOAD_PREFIX)) return null;
  const parsed = deliveryIdSchema.safeParse(payload.slice(FOLLOW_GATE_PAYLOAD_PREFIX.length));
  return parsed.success ? parsed.data.toLowerCase() : null;
}
