import { config } from "dotenv";
config({ path: ".env" });
import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

async function main() {
  try {
    await db.execute(sql`
      ALTER TABLE "agency_project" DROP CONSTRAINT IF EXISTS "agency_project_leadId_lead_id_fk";
      ALTER TABLE "agency_project" ADD CONSTRAINT "agency_project_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE set null ON UPDATE no action;
      CREATE INDEX IF NOT EXISTS "idx_project_lead" ON "agency_project" USING btree ("leadId");
      CREATE INDEX IF NOT EXISTS "idx_project_status" ON "agency_project" USING btree ("status");
      CREATE INDEX IF NOT EXISTS "idx_milestone_project" ON "milestone" USING btree ("projectId");
    `);
    console.log("Migration 11 applied manually successfully.");
  } catch (error) {
    console.error("Error applying migration 11 manually:", error);
  }
  process.exit(0);
}
main();
