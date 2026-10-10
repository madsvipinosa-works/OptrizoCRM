import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

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
    console.log("Executing SQL migration 0012 for system_error_log...");
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE "error_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS "system_error_log" (
          "id" text PRIMARY KEY NOT NULL,
          "error_code" text DEFAULT 'UNKNOWN_ERROR' NOT NULL,
          "severity" error_severity DEFAULT 'MEDIUM' NOT NULL,
          "message" text NOT NULL,
          "stack_trace" text,
          "source" text NOT NULL,
          "context" jsonb DEFAULT '{}'::jsonb,
          "userId" text,
          "is_resolved" boolean DEFAULT false NOT NULL,
          "resolved_at" timestamp with time zone,
          "resolved_by_id" text,
          "resolution_notes" text,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );

      DO $$ BEGIN
       ALTER TABLE "system_error_log" ADD CONSTRAINT "system_error_log_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
      EXCEPTION
       WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
       ALTER TABLE "system_error_log" ADD CONSTRAINT "system_error_log_resolved_by_id_user_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
      EXCEPTION
       WHEN duplicate_object THEN null;
      END $$;

      CREATE INDEX IF NOT EXISTS "idx_error_created" ON "system_error_log" ("created_at");
      CREATE INDEX IF NOT EXISTS "idx_error_severity" ON "system_error_log" ("severity");
      CREATE INDEX IF NOT EXISTS "idx_error_resolved" ON "system_error_log" ("is_resolved");
      CREATE INDEX IF NOT EXISTS "idx_error_code" ON "system_error_log" ("error_code");
    `);
    
    console.log("Migration 0012 executed successfully!");
  } catch (err) {
    console.error("Error executing migration 0012:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
