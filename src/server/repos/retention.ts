import "server-only";
import { sql } from "drizzle-orm";
import { retentionCutoff } from "@/lib/retention";
import { db } from "@/server/db/client";
import { deliveries } from "@/server/db/schema";

export const PURGE_BATCH_SIZE = 1000;
export const PURGE_MAX_BATCHES = 50;

/**
 * Deletes `deliveries` older than `days` days (0 = keep forever) in batches so a large backlog
 * never holds one long lock. Stops after `maxBatches`; the next daily run continues. Returns the
 * number of rows deleted.
 */
export async function purgeOldDeliveries(
  days: number,
  now: Date = new Date(),
  opts: { batchSize?: number; maxBatches?: number } = {},
): Promise<number> {
  const cutoff = retentionCutoff(days, now);
  if (!cutoff) return 0;
  const batchSize = opts.batchSize ?? PURGE_BATCH_SIZE;
  const maxBatches = opts.maxBatches ?? PURGE_MAX_BATCHES;
  let total = 0;
  for (let i = 0; i < maxBatches; i++) {
    const rows = await db
      .delete(deliveries)
      .where(
        sql`${deliveries.id} in (select ${deliveries.id} from ${deliveries} where ${deliveries.createdAt} < ${cutoff.toISOString()}::timestamptz limit ${batchSize})`,
      )
      .returning({ id: deliveries.id });
    total += rows.length;
    if (rows.length < batchSize) break;
  }
  return total;
}
