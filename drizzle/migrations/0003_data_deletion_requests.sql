CREATE TYPE "public"."data_deletion_status" AS ENUM('completed', 'no_data');--> statement-breakpoint
CREATE TABLE "data_deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"confirmation_code" text NOT NULL,
	"ig_user_id" text,
	"status" "data_deletion_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "data_deletion_requests_confirmation_code_unique" UNIQUE("confirmation_code")
);
