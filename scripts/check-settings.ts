
import "dotenv/config";
import { db } from "@/db";

async function main() {
    console.log("Checking DB Settings...");
    const settings = await db.query.siteSettings.findFirst();
    console.log("Settings:", settings);
}

main().catch(console.error).then(() => process.exit(0));
