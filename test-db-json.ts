import { db } from "./src/db";
import { tasks } from "./src/db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
    const task = await db.query.tasks.findFirst();
    if (!task) {
        console.log("No task found");
        return;
    }
    
    console.log("Original proofLinks:", task.proofLinks);
    
    // Attempt standard update
    await db.update(tasks).set({
        proofLinks: [{ label: "Test", url: "https://example.com" }]
    }).where(eq(tasks.id, task.id));
    
    let updated = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) });
    console.log("Updated proofLinks standard:", updated?.proofLinks);
    
    // Revert
    await db.update(tasks).set({
        proofLinks: task.proofLinks
    }).where(eq(tasks.id, task.id));
    
    // Attempt SQL update (what is in the codebase right now)
    const newLinks = [{ label: "Test SQL", url: "https://sql.com" }];
    await db.update(tasks).set({
        proofLinks: sql`${JSON.stringify(newLinks)}::jsonb`
    }).where(eq(tasks.id, task.id));
    
    updated = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) });
    console.log("Updated proofLinks SQL:", updated?.proofLinks);

    // Revert
    await db.update(tasks).set({
        proofLinks: task.proofLinks
    }).where(eq(tasks.id, task.id));
}

main().catch(console.error).finally(() => process.exit(0));
