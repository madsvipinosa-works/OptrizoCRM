ALTER TYPE "public"."activity_type" ADD VALUE 'outside_discussion';--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "stage_changed_at" timestamp with time zone;