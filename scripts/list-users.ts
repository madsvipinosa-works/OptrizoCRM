import "dotenv/config";
import { db } from "@/db";
import { users } from "@/db/schema";

async function main() {
    const allUsers = await db.select().from(users);
    console.log("--- Registered Users ---");
    allUsers.forEach(u => {
        console.log(`ID: ${u.id} | Email: ${u.email} | Role: ${u.role}`);
    });
}

main();
