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
    console.log("Executing SQL migration 0009...");
    await pool.query(`
      ALTER TABLE "agency_project" ADD COLUMN IF NOT EXISTS "source_brief" TEXT;
    `);
    console.log("✓ source_brief column added to agency_project");
    
    console.log("Migration 0009 executed successfully!");
  } catch (err) {
    console.error("Error executing migration:", err);
  } finally {
    await pool.end();
  }
}

main();
