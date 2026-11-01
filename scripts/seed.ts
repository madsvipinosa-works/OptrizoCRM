import "dotenv/config";
import { db } from "../src/db";
import { users, services, leads } from "../src/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seed() {
    console.log("🌱 [Seed] Starting database seeding...\n");

    const DEMO_PASSWORD = "Password123!";
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    // ========================================================
    // 1. ONE USER PER ROLE (6 ROLES)
    // ========================================================
    console.log("👤 Seeding demo users for each role...");

    const roleUsers = [
        {
            name: "Super Admin",
            email: "admin@optrizo.com",
            role: "superadmin" as const,
            jobTitle: "Agency Director",
            companyName: "Optrizo Digital Solutions",
        },
        {
            name: "Alex Vance",
            email: "sales@optrizo.com",
            role: "sales" as const,
            jobTitle: "Senior Sales Representative",
            companyName: "Optrizo Digital Solutions",
        },
        {
            name: "Marcus Vance",
            email: "pm@optrizo.com",
            role: "manager" as const,
            jobTitle: "Technical Project Manager",
            companyName: "Optrizo Digital Solutions",
        },
        {
            name: "Devon Chen",
            email: "dev@optrizo.com",
            role: "developer" as const,
            jobTitle: "Full-Stack Engineer",
            companyName: "Optrizo Digital Solutions",
        },
        {
            name: "Claire Diaz",
            email: "editor@optrizo.com",
            role: "content_editor" as const,
            jobTitle: "Content & Marketing Editor",
            companyName: "Optrizo Digital Solutions",
        },
        {
            name: "Elena Rostova",
            email: "client@optrizo.com",
            role: "client" as const,
            jobTitle: "Chief Technology Officer",
            companyName: "Vanguard Global Logistics",
        },
    ];

    for (const u of roleUsers) {
        const [existing] = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
        if (existing) {
            await db.update(users)
                .set({
                    name: u.name,
                    role: u.role,
                    password: passwordHash,
                    jobTitle: u.jobTitle,
                    companyName: u.companyName,
                    isActive: true,
                    emailVerified: new Date(),
                })
                .where(eq(users.id, existing.id));
            console.log(`   ✓ Updated ${u.role}: ${u.email}`);
        } else {
            await db.insert(users).values({
                name: u.name,
                email: u.email,
                role: u.role,
                password: passwordHash,
                jobTitle: u.jobTitle,
                companyName: u.companyName,
                isActive: true,
                emailVerified: new Date(),
            });
            console.log(`   + Created ${u.role}: ${u.email}`);
        }
    }

    // ========================================================
    // 2. THE 6 PRESET SERVICES (FROM SPEC SECTION 3)
    // ========================================================
    console.log("\n📦 Seeding 6 preset services...");

    const presetServices = [
        {
            title: "Web Development",
            slug: "web-development",
            description: "Custom high-performance websites and web applications built with modern frameworks.",
            icon: "Code2",
            order: 1,
            category: "Engineering",
            timelineEstimate: "4-8 Weeks",
            scopeOverview: "Full-stack web application development, architecture design, and database modeling.",
        },
        {
            title: "Mobile App",
            slug: "mobile-app",
            description: "Native and cross-platform mobile apps for iOS and Android with smooth offline capabilities.",
            icon: "Smartphone",
            order: 2,
            category: "Mobile",
            timelineEstimate: "6-12 Weeks",
            scopeOverview: "End-to-end mobile development with App Store and Google Play deployment.",
        },
        {
            title: "UI/UX Design",
            slug: "ui-ux-design",
            description: "User-centered interface design, wireframing, high-fidelity interactive prototyping, and design systems.",
            icon: "Palette",
            order: 3,
            category: "Design",
            timelineEstimate: "2-4 Weeks",
            scopeOverview: "User research, Figma component libraries, responsive design layouts, and design tokens.",
        },
        {
            title: "E-commerce Website",
            slug: "ecommerce-website",
            description: "Scalable online stores with seamless payment gateway integrations, catalog management, and checkout flows.",
            icon: "ShoppingCart",
            order: 4,
            category: "E-Commerce",
            timelineEstimate: "4-8 Weeks",
            scopeOverview: "Custom storefront, payment processing, inventory synchronization, and analytics tracking.",
        },
        {
            title: "Custom Business System",
            slug: "custom-business-system",
            description: "Tailored internal tools, ERPs, CRMs, and automated administrative workflow solutions.",
            icon: "Layers",
            order: 5,
            category: "Enterprise",
            timelineEstimate: "8-16 Weeks",
            scopeOverview: "Business process automation, role-based access control, auditing, and systems integration.",
        },
        {
            title: "Website Maintenance",
            slug: "website-maintenance",
            description: "Continuous security updates, performance monitoring, automated backups, and 24/7 technical support.",
            icon: "ShieldCheck",
            order: 6,
            category: "Support",
            timelineEstimate: "Ongoing",
            scopeOverview: "Monthly SLA support, dependency updates, uptime monitoring, and vulnerability patching.",
        },
    ];

    const seededServices: Record<string, string> = {};

    for (const s of presetServices) {
        const [existing] = await db.select().from(services).where(eq(services.title, s.title)).limit(1);
        if (existing) {
            await db.update(services)
                .set({
                    slug: s.slug,
                    description: s.description,
                    icon: s.icon,
                    order: s.order,
                    category: s.category,
                    timelineEstimate: s.timelineEstimate,
                    scopeOverview: s.scopeOverview,
                })
                .where(eq(services.id, existing.id));
            seededServices[s.title] = existing.id;
            console.log(`   ✓ Updated service: ${s.title}`);
        } else {
            const [created] = await db.insert(services).values({
                title: s.title,
                slug: s.slug,
                description: s.description,
                icon: s.icon,
                order: s.order,
                category: s.category,
                timelineEstimate: s.timelineEstimate,
                scopeOverview: s.scopeOverview,
            }).returning();
            seededServices[s.title] = created.id;
            console.log(`   + Created service: ${s.title}`);
        }
    }

    // ========================================================
    // 3. TWO LEADS (ONE LOCAL, ONE INTERNATIONAL)
    // ========================================================
    console.log("\n🎯 Seeding two leads (one local, one international)...");

    const [clientUser] = await db.select().from(users).where(eq(users.email, "client@optrizo.com")).limit(1);

    const demoLeads = [
        {
            clientId: clientUser?.id || null,
            businessName: "Aura Retail Philippines Inc.",
            contactName: "Juan Dela Cruz",
            contactEmail: "juan.delacruz@auraretail.ph",
            contactPhone: "+639171234567",
            budget: "PHP 250,000",
            estimatedValue: 250000,
                        qualificationStatus: "Lead" as const,
            priority: "Warm",
            goals: "Local Philippine retail e-commerce platform and inventory system for Metro Manila outlets.",
            industry: "Retail & Consumer Goods",
            timelineExpectation: "2 Months",
            status: "New Lead" as const,
            source: "Website Inquiry (Local)",
            serviceId: seededServices["E-commerce Website"] || null,
        },
        {
            clientId: clientUser?.id || null,
            businessName: "Apex Global Solutions LLC",
            contactName: "Sarah Jenkins",
            contactEmail: "sarah.jenkins@apexglobal.io",
            contactPhone: "+14155550199",
            budget: "$15,000 USD",
            estimatedValue: 850000,
                        qualificationStatus: "Lead" as const,
            priority: "Hot",
            goals: "International multi-tenant business automation system and API integrations across North America.",
            industry: "Technology & Software",
            timelineExpectation: "3 Months",
            status: "New Lead" as const,
            source: "Website Inquiry (International)",
            serviceId: seededServices["Custom Business System"] || null,
        },
    ];

    for (const leadData of demoLeads) {
        const [existing] = await db.select().from(leads).where(eq(leads.contactEmail, leadData.contactEmail)).limit(1);
        if (existing) {
            await db.update(leads)
                .set(leadData)
                .where(eq(leads.id, existing.id));
            console.log(`   ✓ Updated lead: ${leadData.businessName} (${leadData.source})`);
        } else {
            await db.insert(leads).values(leadData);
            console.log(`   + Created lead: ${leadData.businessName} (${leadData.source})`);
        }
    }

    // ========================================================
    // 4. PRINT LOGINS SUMMARY
    // ========================================================
    console.log("\n===============================================================================");
    console.log("                     OPTRIZO DEMO LOGINS & ROLES                                ");
    console.log("===============================================================================");
    console.log(" Role           | Email                  | Demo Password");
    console.log("----------------+------------------------+-------------------------------------");
    for (const u of roleUsers) {
        console.log(` ${u.role.padEnd(14)} | ${u.email.padEnd(22)} | ${DEMO_PASSWORD}`);
    }
    console.log("===============================================================================");
    console.log(" Preset Services: 6 configured (Web Development, Mobile App, UI/UX Design,");
    console.log("                                E-commerce Website, Custom Business System,");
    console.log("                                Website Maintenance)");
    console.log(" Leads Seeded:    2 leads (1 Local: Aura Retail Philippines Inc.,");
    console.log("                           1 International: Apex Global Solutions LLC)");
    console.log("===============================================================================\n");

    process.exit(0);
}

seed().catch((err) => {
    console.error("❌ Seed failed with error:", err);
    process.exit(1);
});
