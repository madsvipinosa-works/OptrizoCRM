import "dotenv/config";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq, inArray } from "drizzle-orm";

async function main() {
    const emails = ["maderickph7777@gmail.com", "mads.vipinosa@gmail.com"];
    console.log(`Promoting ${emails.join(", ")} to admin...`);

    try {
        await db.update(users)
            .set({ role: "admin" })
            .where(inArray(users.email, emails));

        console.log(`✅ Success! The accounts are now ADMINS!`);
        process.exit(0);
    } catch (e) {
        console.error("❌ Failed: ", e);
        process.exit(1);
    }
}

main();
