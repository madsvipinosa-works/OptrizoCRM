-- Rename table
ALTER TABLE "message" RENAME TO "lead";

-- Create Enum
CREATE TYPE "public"."lead_status" AS ENUM('New', 'Contacted', 'In Progress', 'Completed', 'Lost');

-- Add new columns
ALTER TABLE "lead" ADD COLUMN "status" "lead_status" DEFAULT 'New' NOT NULL;
ALTER TABLE "lead" ADD COLUMN "score" integer DEFAULT 0;
ALTER TABLE "lead" ADD COLUMN "budget" text;
ALTER TABLE "lead" ADD COLUMN "source" text DEFAULT 'Website Form';
ALTER TABLE "lead" ADD COLUMN "notes" text;

-- Rename 'content' column to 'message' if needed
ALTER TABLE "lead" RENAME COLUMN "content" TO "message";
