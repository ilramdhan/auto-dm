ALTER TABLE "campaigns" ADD COLUMN "media_ids" text[];--> statement-breakpoint
CREATE INDEX "campaigns_media_ids_idx" ON "campaigns" USING gin ("media_ids");