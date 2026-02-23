import "dotenv/config";
import { db } from "../src/db";
import { users, agencyProjects } from "../src/db/schema";
import { eq, inArray } from "drizzle-orm";

async function main() {
    console.log("Looking for stranded Client accounts...");

    try {
        // Find all projects
        const allProjects = await db.select().from(agencyProjects);

        // Find users for those projects
        const clientIds = allProjects.map(p => p.clientId).filter(Boolean) as string[];

        if (clientIds.length > 0) {
            // Upgrade any user attached to a project who is still just a "user"
            const affectedUsers = await db.select().from(users)
                .where(inArray(users.id, clientIds));

            let fixedCount = 0;
            for (const user of affectedUsers) {
                if (user.role === "user") {
                    await db.update(users).set({ role: "client" }).where(eq(users.id, user.id));
                    console.log(`✅ Upgraded ${user.email} from 'user' to 'client'.`);
                    fixedCount++;
                }
            }
            console.log(`Finished fixing ${fixedCount} stranded accounts.`);
        } else {
            console.log("No Active Projects with Clients Found.");
        }

        process.exit(0);
    } catch (e) {
        console.error("❌ Failed fixing accounts: ", e);
        process.exit(1);
    }
}

main();
