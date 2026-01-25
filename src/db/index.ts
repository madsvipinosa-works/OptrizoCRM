import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    // Warn only in development, or throw? For now just log usage might fail.
    // We'll let Pool throw if it's missing, or handle it gracefully.
    console.warn("⚠️ DATABASE_URL is not set in environment variables.");
}

const pool = new Pool({
    connectionString: connectionString || "postgres://postgres:postgres@localhost:5432/optrizo", // Fallback for dev/safety
});

import * as schema from "./schema";

// Supabase Transaction Mode requires verify: false usually, or prepare: false
export const db = drizzle(pool, { schema });
