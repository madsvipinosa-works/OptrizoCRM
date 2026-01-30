import "dotenv/config";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    const targetEmail = "mads.vipinosa@gmail.com";
    console.log(`Promoting ${targetEmail} to ADMIN...`);

    try {
        await db.update(users)
            .set({ role: "admin" })
            .where(eq(users.email, targetEmail));

        console.log("✅ Use role updated successfully!");
    } catch (err) {
        console.error("Failed to update role:", err);
    }
    process.exit(0);
}

main();
