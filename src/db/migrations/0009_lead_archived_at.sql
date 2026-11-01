ALTER TABLE "lead" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_lead_archived_at" ON "lead" USING btree ("archived_at");