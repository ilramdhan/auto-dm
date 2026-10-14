import { z } from "zod";

export const DELIVERY_STATUSES = ["received", "processing", "skipped", "sent", "partial", "failed"] as const;
export type DeliveryStatusValue = (typeof DELIVERY_STATUSES)[number];

export const ACTIVITY_PAGE_SIZE = 25;

/** Parses `/activity` search params; invalid values fall back to defaults instead of erroring. */
export const activityFiltersSchema = z.object({
  status: z.enum(DELIVERY_STATUSES).optional().catch(undefined),
  campaign: z.uuid().optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});
export type ActivityFilters = z.infer<typeof activityFiltersSchema>;
