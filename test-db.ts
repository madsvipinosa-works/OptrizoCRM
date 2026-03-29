import { db } from "./src/db";

async function main() {
    try {
        const settings = await db.query.siteSettings.findFirst();
        console.log("Settings from DB:", settings);
    } catch (e) {
        console.error("DB Error:", e);
    }
}

main().then(() => process.exit(0));
