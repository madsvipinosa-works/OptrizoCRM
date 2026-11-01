ALTER TABLE "agency_project" DROP CONSTRAINT "agency_project_leadId_lead_id_fk";
ALTER TABLE "agency_project" ADD CONSTRAINT "agency_project_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "idx_project_lead" ON "agency_project" USING btree ("leadId");
CREATE INDEX IF NOT EXISTS "idx_project_status" ON "agency_project" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_milestone_project" ON "milestone" USING btree ("projectId");
