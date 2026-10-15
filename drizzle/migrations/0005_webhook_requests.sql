CREATE TYPE "public"."webhook_request_kind" AS ENUM('delivery', 'verification');--> statement-breakpoint
CREATE TYPE "public"."webhook_request_result" AS ENUM('accepted', 'signature_invalid', 'not_configured', 'invalid_payload', 'too_large', 'api_key_invalid', 'error', 'verified', 'forbidden');--> statement-breakpoint
CREATE TYPE "public"."webhook_request_source" AS ENUM('direct', 'n8n');--> statement-breakpoint
CREATE TABLE "webhook_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "webhook_request_kind" NOT NULL,
	"source" "webhook_request_source" DEFAULT 'direct' NOT NULL,
	"result" "webhook_request_result" NOT NULL,
	"status_code" integer NOT NULL,
	"entries" integer,
	"comment_events" integer,
	"matched_entries" integer,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "webhook_requests_created_idx" ON "webhook_requests" USING btree ("created_at");