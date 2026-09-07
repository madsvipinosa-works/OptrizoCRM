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
    console.log("Executing SQL migration 0008...");
    // 1. Run ALTER TYPE standalone (cannot run in transaction)
    await pool.query("ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'Changes Requested';");
    console.log("✓ ALTER TYPE task_status executed");

    // 2. Run the rest of the migration
    await pool.query(`
      DO $$ BEGIN
          CREATE TYPE quality_gate_status AS ENUM ('Pending', 'Passed', 'Failed');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("✓ quality_gate_status enum created");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_submission (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
          "taskId" TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
          submitted_by TEXT,
          proof_url TEXT NOT NULL,
          submission_notes TEXT NOT NULL,
          ai_confidence_score INTEGER NOT NULL,
          gate_status quality_gate_status NOT NULL,
          ai_summary TEXT NOT NULL,
          criteria_breakdown JSONB DEFAULT '[]'::jsonb NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);
    console.log("✓ task_submission table created");

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_task_submission_task_created 
      ON task_submission("taskId", created_at DESC);
    `);
    console.log("✓ Index created");

    console.log("Migration 0008 executed successfully!");
  } catch (err) {
    console.error("Error executing migration:", err);
  } finally {
    await pool.end();
  }
}

main();
