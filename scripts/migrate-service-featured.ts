import "dotenv/config";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function runMigration() {
    console.log("Applying service is_featured column migration...");
    try {
        await db.execute(sql`
            ALTER TABLE "service" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;
        `);
        console.log("Column is_featured ensured.");

        // Check count of featured
        const featuredCountRes = await db.execute(sql`
            SELECT COUNT(*)::int as count FROM "service" WHERE "is_featured" = true;
        `);
        const count = featuredCountRes.rows[0]?.count ?? 0;
        console.log(`Current featured services count: ${count}`);

        if (Number(count) === 0) {
            console.log("Setting top 4 services as featured by default...");
            await db.execute(sql`
                UPDATE "service"
                SET "is_featured" = true
                WHERE "id" IN (
                    SELECT "id" FROM "service"
                    ORDER BY "order" ASC
                    LIMIT 4
                );
            `);
            console.log("Top 4 services marked as featured.");
        }
        console.log("✅ Migration completed successfully.");
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
}

runMigration().then(() => process.exit(0));
