import "dotenv/config";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("🔄 Starting CRM Lead Status & Loss Reason Database Migration...");

    try {
        // 1. Fetch current enum values of lead_status
        const result = await db.execute(sql`
            SELECT enumlabel 
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE pg_type.typname = 'lead_status';
        `);

        const currentLabels = result.rows.map((row: any) => row.enumlabel);
        console.log("Current lead_status labels:", currentLabels);

        // 2. Rename 'Pending Approval' -> 'New Lead' if present
        if (currentLabels.includes("Pending Approval") && !currentLabels.includes("New Lead")) {
            console.log("Renaming 'Pending Approval' to 'New Lead'...");
            await db.execute(sql`ALTER TYPE lead_status RENAME VALUE 'Pending Approval' TO 'New Lead';`);
            console.log("✅ Renamed 'Pending Approval' -> 'New Lead'");
        }

        // 3. Rename 'In Review' -> 'Discovery & Qualifying' if present
        if (currentLabels.includes("In Review") && !currentLabels.includes("Discovery & Qualifying")) {
            console.log("Renaming 'In Review' to 'Discovery & Qualifying'...");
            await db.execute(sql`ALTER TYPE lead_status RENAME VALUE 'In Review' TO 'Discovery & Qualifying';`);
            console.log("✅ Renamed 'In Review' -> 'Discovery & Qualifying'");
        }

        // 4. Add 'In Negotiation' after 'Proposal Sent' if not already present
        if (!currentLabels.includes("In Negotiation")) {
            console.log("Adding 'In Negotiation' value to lead_status...");
            await db.execute(sql`ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'In Negotiation' AFTER 'Proposal Sent';`);
            console.log("✅ Added 'In Negotiation'");
        }

        // 5. Create loss_reason enum if it does not exist
        console.log("Creating loss_reason enum type...");
        await db.execute(sql`
            DO $$ BEGIN
                CREATE TYPE loss_reason AS ENUM (
                    'budget_too_low',
                    'competitor_chosen',
                    'scope_mismatch',
                    'timing_ghosted',
                    'internal_cancellation',
                    'other'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        console.log("✅ loss_reason enum verified/created");

        console.log("🎉 Database Migration Finished Successfully!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
}

main();
