ALTER TABLE "lead" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "lead" ALTER COLUMN "status" SET DEFAULT 'New Inquiry'::text;--> statement-breakpoint
DROP TYPE "public"."lead_status";--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('New', 'Contacted', 'In Progress', 'Completed', 'Lost', 'New Inquiry', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won');--> statement-breakpoint
ALTER TABLE "lead" ALTER COLUMN "status" SET DEFAULT 'New Inquiry'::"public"."lead_status";--> statement-breakpoint
ALTER TABLE "lead" ALTER COLUMN "status" SET DATA TYPE "public"."lead_status" USING "status"::"public"."lead_status";