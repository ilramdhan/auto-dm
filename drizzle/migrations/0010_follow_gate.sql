CREATE TYPE "public"."follow_gate_status" AS ENUM('pending', 'unlocked');--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "follow_gate_status" "follow_gate_status";--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "follow_gate_unlocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "follow_gate_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "follow_gate_message" text;--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "follow_gate_button_title" text;--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "follow_gate_retry_message" text;