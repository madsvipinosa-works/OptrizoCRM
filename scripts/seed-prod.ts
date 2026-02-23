import "dotenv/config";
import { db } from "../src/db";
import { users, leads, agencyProjects, milestones, siteSettings } from "../src/db/schema";

async function main() {
    console.log("🌱 Starting Production Seed...");

    try {
        // 1. Initialize Site Settings (Required for metrics to work)
        console.log("Setting up global site settings...");
        await db.insert(siteSettings).values({
            heroTitle: "Build Something Amazing",
            heroDescription: "We craft digital experiences that elevate your brand.",
            contactEmail: "hello@optrizo.com",
            monthlyMarketingSpend: 1500,
            adminHoursSavedPerProject: 4
        });

        // 2. Create a Mock Client User
        console.log("Creating Mock Client User...");
        const [mockClient] = await db.insert(users).values({
            name: "Acme Corp CEO",
            email: "client@acme.com",
            role: "client"
        }).returning({ id: users.id });

        // 3. Create a Mock Lead
        console.log("Creating Mock CRM Lead...");
        const [mockLead] = await db.insert(leads).values({
            name: "John Doe",
            email: "john@acmeweb.com",
            service: "Full Website Redesign",
            budget: "$10k - $25k",
            message: "We need a massive overhaul of our legacy systems.",
            status: "Completed", // Setting to Completed as they are already a client
        }).returning({ id: leads.id });

        // 4. Create an Active Project
        console.log("Provisioning Active Mock Project...");
        const [mockProject] = await db.insert(agencyProjects).values({
            title: "Acme Corp Web Transformation",
            description: "Full stack rebuild using Next.js and Supabase.",
            clientId: mockClient.id,
            leadId: mockLead.id,
            status: "In Progress"
        }).returning({ id: agencyProjects.id });

        // 5. Build Project Milestones
        console.log("Injecting Project Milestones...");
        await db.insert(milestones).values([
            { projectId: mockProject.id, title: "Discovery & Wireframing", status: "Completed", order: 1 },
            { projectId: mockProject.id, title: "UI/UX Design", status: "In Progress", order: 2 },
            { projectId: mockProject.id, title: "Frontend Development", status: "Pending", order: 3 },
            { projectId: mockProject.id, title: "QA & Launch", status: "Pending", order: 4 },
        ]);

        console.log("✅ Production Seed Complete!");
        process.exit(0);
    } catch (e) {
        console.error("❌ Seed Failed: ", e);
        process.exit(1);
    }
}

main();
