import "dotenv/config";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
    await db.execute(sql`DROP TRIGGER IF EXISTS trg_task_progress_sync ON task;`);
    console.log("Trigger dropped successfully.");
}

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
