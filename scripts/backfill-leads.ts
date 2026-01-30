import "dotenv/config";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { isNull } from "drizzle-orm";

async function main() {
    console.log("Backfilling missing service data...");

    const result = await db.update(leads)
        .set({ service: "Backfilled Inquiry" }) // Valid string so it shows up in UI
        .where(isNull(leads.service));

    console.log("✅ Backfill complete. Leads updated.");
    process.exit(0);
}

main();
