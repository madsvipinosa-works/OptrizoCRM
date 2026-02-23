import "dotenv/config";
import { db } from "../src/db";
import { users } from "../src/db/schema";

async function main() {
    console.log("Checking live database for registered users...");
    try {
        const allUsers = await db.select().from(users);
        console.log(`Found ${allUsers.length} users in the database.`);
        allUsers.forEach(u => {
            console.log(`- ID: ${u.id}`);
            console.log(`- Email: ${u.email}`);
            console.log(`- Role: ${u.role}`);
            console.log(`- Name: ${u.name}`);
        });
        process.exit(0);
    } catch (e) {
        console.error("❌ Failed to query users: ", e);
        process.exit(1);
    }
}

main();
