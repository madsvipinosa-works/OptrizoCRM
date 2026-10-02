const { Client } = require("pg");
require("dotenv").config();

async function main() {
    const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
        throw new Error("Neither DIRECT_URL nor DATABASE_URL is set");
    }

    console.log("Connecting to database...");
    const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log("Connected to database. Checking inquiry schema...");

    try {
        // 1. Check existing columns in "inquiry"
        const colsRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'inquiry'
        `);
        console.log("Current columns in inquiry table:", colsRes.rows.map(r => r.column_name));

        // 2. Ensure enum has 'Archived' if type exists
        try {
            await client.query(`ALTER TYPE "inquiry_status" ADD VALUE IF NOT EXISTS 'Archived'`);
            console.log("Updated inquiry_status enum if needed.");
        } catch (err) {
            console.log("Note on inquiry_status enum:", err.message);
        }

        // 3. Add columns
        await client.query(`ALTER TABLE "inquiry" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'Website Form'`);
        await client.query(`ALTER TABLE "inquiry" ADD COLUMN IF NOT EXISTS "nextAction" text`);
        await client.query(`ALTER TABLE "inquiry" ADD COLUMN IF NOT EXISTS "isHandled" boolean DEFAULT false NOT NULL`);
        await client.query(`ALTER TABLE "inquiry" ADD COLUMN IF NOT EXISTS "ownerId" text REFERENCES "user"("id") ON DELETE SET NULL`);

        console.log("Successfully migrated inquiry table columns.");

        // 4. Verify columns after update
        const afterCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'inquiry'
        `);
        console.log("Columns in inquiry table after migration:", afterCols.rows.map(r => r.column_name));
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
