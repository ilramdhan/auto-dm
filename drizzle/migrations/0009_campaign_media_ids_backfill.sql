-- Multi-post campaigns (#98): copy each post campaign's single `media_id` into `media_ids`.
-- Idempotent and safe on a populated DB: only rows not yet backfilled are touched, `media_id` is kept.
UPDATE "campaigns" SET "media_ids" = ARRAY["media_id"]
WHERE "media_id" IS NOT NULL AND ("media_ids" IS NULL OR cardinality("media_ids") = 0);
