import { db } from "./src/db";
import { users } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    try {
        const team = await db.query.users.findMany({ where: eq(users.showOnAboutPage, true) });
        console.log("Team members:", team.map(t => ({ name: t.name, image: t.image })));
    } catch (e) {
        console.error("DB Error:", e);
    }
}

main().then(() => process.exit(0));
