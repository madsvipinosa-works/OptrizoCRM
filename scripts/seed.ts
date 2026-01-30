import "dotenv/config";
import { db } from "@/db";
import { services } from "@/db/schema";

async function seed() {
    console.log("Seeding services...");
    try {
        await db.insert(services).values([
            { title: "Web Development", description: "Custom websites and web apps.", icon: "Globe" },
            { title: "Mobile App Development", description: "iOS and Android apps.", icon: "Smartphone" },
            { title: "UI/UX Design", description: "User-centered design.", icon: "Palette" },
            { title: "SEO Optimization", description: "Rank higher on search engines.", icon: "Search" },
            { title: "Cloud Solutions", description: "Scalable cloud infrastructure.", icon: "Cloud" },
        ]);
        console.log("Seeding complete!");
    } catch (error) {
        console.error("Seeding failed:", error);
    }
    process.exit(0);
}

seed();
