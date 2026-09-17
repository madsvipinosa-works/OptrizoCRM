import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
  console.error("No connection string found.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString && !connectionString.includes("localhost") && !connectionString.includes("127.0.0.1")
    ? { rejectUnauthorized: false }
    : undefined,
});

async function main() {

  try {
    console.log("Executing SQL migration 0010...");
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE "crm_task_status" AS ENUM('Pending', 'In Progress', 'Completed', 'Canceled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "crm_task_type" AS ENUM('Call', 'Email', 'Meeting', 'To-do');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "crm_task_priority" AS ENUM('Low', 'Medium', 'High');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "qualification_status" AS ENUM('Lead', 'MQL', 'SQL');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "qualificationStatus" qualification_status DEFAULT 'Lead' NOT NULL;

      CREATE TABLE IF NOT EXISTS "crm_task" (
          "id" text PRIMARY KEY NOT NULL,
          "leadId" text NOT NULL,
          "assignedTo" text,
          "title" text NOT NULL,
          "description" text,
          "task_type" crm_task_type DEFAULT 'To-do' NOT NULL,
          "status" crm_task_status DEFAULT 'Pending' NOT NULL,
          "priority" crm_task_priority DEFAULT 'Medium' NOT NULL,
          "due_date" timestamp with time zone,
          "completed_at" timestamp with time zone,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );

      DO $$ BEGIN
       ALTER TABLE "crm_task" ADD CONSTRAINT "crm_task_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
       WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
       ALTER TABLE "crm_task" ADD CONSTRAINT "crm_task_assignedTo_user_id_fk" FOREIGN KEY ("assignedTo") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
      EXCEPTION
       WHEN duplicate_object THEN null;
      END $$;

      CREATE INDEX IF NOT EXISTS "idx_crm_task_lead" ON "crm_task" ("leadId");
      CREATE INDEX IF NOT EXISTS "idx_crm_task_assignee_status" ON "crm_task" ("assignedTo", "status");
      CREATE INDEX IF NOT EXISTS "idx_crm_task_due_status" ON "crm_task" ("due_date", "status");

      DO $$ BEGIN
        ALTER TABLE "lead" RENAME COLUMN "qualificationStatus" TO "qualification_status";
      EXCEPTION
        WHEN undefined_column THEN null;
      END $$;
    `);
    
    console.log("Migration 0010 executed successfully!");
  } catch (err) {
    console.error("Error executing migration:", err);
  } finally {
    await pool.end();
  }
}

main();
