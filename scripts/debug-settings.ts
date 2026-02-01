import 'dotenv/config';
import { db } from '../src/db';
import { siteSettings } from '../src/db/schema';

async function main() {
    const s = await db.query.siteSettings.findFirst();
    console.log("Current Settings:", JSON.stringify(s, null, 2));
}
main().catch(console.error);
