import { config } from "dotenv";
import { resolve } from "path";
import { Client } from "pg";

// Load .env from root
config({ path: resolve(process.cwd(), ".env") });

async function main() {
    const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
        throw new Error("DIRECT_URL or DATABASE_URL is not set");
    }

    const client = new Client({
        connectionString: dbUrl,
        ssl: !dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1") ? { rejectUnauthorized: false } : undefined
    });
    
    await client.connect();
    console.log("Connected to database. Checking site_settings schema...");

    try {
        await client.query(`ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "about_hero_title" text DEFAULT 'About Our Agency'`);
        await client.query(`ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "mission_statement" text`);
        await client.query(`ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "company_stats" jsonb DEFAULT '[]'::jsonb NOT NULL`);
        await client.query(`ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "about_tech_stack" text DEFAULT 'Powered By Next-Generation Technologies'`);
        await client.query(`ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "about_tech_stack_items" jsonb DEFAULT '[]'::jsonb NOT NULL`);
        await client.query(`ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "about_cta_headline" text DEFAULT 'Ready to start your next project?'`);
        await client.query(`ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "about_cta_text" text DEFAULT 'Let''s build something extraordinary together.'`);

        console.log("Successfully migrated site_settings table.");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
