import { db } from "./index";
import { leads } from "./schema";
import { eq } from "drizzle-orm";
import { parseBudgetToEstimatedValue } from "../lib/utils";

async function run() {
    console.log("Starting Budget Migration...");
    
    try {
        const allLeads = await db.query.leads.findMany();
        console.log(`Found ${allLeads.length} leads to process.`);
        
        for (const lead of allLeads) {
            const estimatedValue = parseBudgetToEstimatedValue(lead.budget);
            
            await db.update(leads)
                .set({ estimatedValue })
                .where(eq(leads.id, lead.id));
                
            console.log(`Updated lead ${lead.id} (Budget: ${lead.budget}) -> Estimated Value: ${estimatedValue}`);
        }
        
        console.log("Migration completed successfully.");
    } catch (error) {
        console.error("Migration failed:", error);
    }
    
    process.exit(0);
}

// Only run if executed directly
if (require.main === module) {
    run();
}
