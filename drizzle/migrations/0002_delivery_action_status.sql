CREATE TYPE "public"."action_status" AS ENUM('not_attempted', 'sent', 'failed');--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "public_reply_status" "action_status" DEFAULT 'not_attempted' NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "dm_status" "action_status" DEFAULT 'not_attempted' NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "error_code" text;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
CREATE INDEX "deliveries_campaign_created_idx" ON "deliveries" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE INDEX "deliveries_media_created_idx" ON "deliveries" USING btree ("media_id","created_at");