import "dotenv/config";
import { db } from "../src/db";
import { users, services, projects, testimonials, posts, siteSettings } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("🌱 Starting CMS Mock Data Seed...");

    try {
        // 1. Get an Author for the Blog Posts (Use the admin account)
        const allUsers = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
        let authorId = allUsers.length > 0 ? allUsers[0].id : null;

        if (!authorId) {
            console.log("No admin found for blog author. Looking for any user...");
            const anyUser = await db.select().from(users).limit(1);
            if (anyUser.length > 0) {
                authorId = anyUser[0].id;
            } else {
                throw new Error("❌ No users exist in the database. Please log in once to create an account before seeding the CMS.");
            }
        }

        // 2. Seed Services
        console.log("Seeding Services...");
        await db.insert(services).values([
            {
                title: "Custom Web App Development",
                description: "Full-stack web applications built with Next.js, React, and modern databases. Tailored specifically to your business operations and workflows.",
                icon: "Laptop",
                order: 1
            },
            {
                title: "UI/UX & Product Design",
                description: "Stunning, conversion-optimized interfaces and user experiences. We map out the perfect user journey from wireframes to high-fidelity prototypes.",
                icon: "PenTool",
                order: 2
            },
            {
                title: "E-Commerce Solutions",
                description: "High-performance storefronts integrated with Stripe and custom inventory management systems to scale your online sales.",
                icon: "ShoppingCart",
                order: 3
            }
        ]);

        // 3. Seed Portfolio Projects
        console.log("Seeding Portfolio Projects...");
        await db.insert(projects).values([
            {
                title: "Nexus Dashboard",
                slug: "nexus-dashboard",
                description: "A complete overhaul of an enterprise SaaS analytics dashboard.",
                content: "<p>The client approached us with a legacy dashboard that was slow and difficult to use. We completely re-architected the frontend using Next.js and Tailwind CSS, improving load times by 400% and increasing user retention.</p>",
                clientName: "Nexus Analytics Inc.",
                status: "published"
            },
            {
                title: "Aura E-Commerce",
                slug: "aura-ecommerce",
                description: "Headless Shopify integration for a sustainable fashion brand.",
                content: "<p>Aura needed a blazing fast storefront that matched their premium brand identity. We built a custom Next.js frontend pulling from Shopify's Storefront API, resulting in a 60% increase in mobile conversion rates.</p>",
                clientName: "Aura Fashion",
                status: "published"
            }
        ]);

        // 4. Seed Testimonials
        console.log("Seeding Testimonials...");
        await db.insert(testimonials).values([
            {
                name: "Sarah Jenkins",
                role: "Chief Marketing Officer",
                company: "TechNova",
                content: "Optrizo completely transformed our digital presence. The custom web app they built for our internal team has saved us hundreds of hours entirely automating our legacy workflows.",
                rating: 5,
                active: true
            },
            {
                name: "David Chen",
                role: "Founder",
                company: "Elevate Startup",
                content: "Working with this agency was the best decision we made for our seed round. They delivered a breathtaking product design way ahead of schedule. Highly recommended team.",
                rating: 5,
                active: true
            }
        ]);

        // 5. Seed Blog Posts
        console.log("Seeding Blog Posts...");
        await db.insert(posts).values([
            {
                title: "Why Next.js is the Future of Enterprise Apps",
                slug: "why-nextjs-is-the-future",
                excerpt: "Discover why Fortune 500 companies are migrating their legacy React applications to Next.js for better performance and SEO.",
                content: "<h1>The Shift to Server Components</h1><p>Next.js 14 and React Server Components have fundamentally changed how we build web applications...</p>",
                published: true,
                authorId: authorId
            },
            {
                title: "Designing for Conversion in 2026",
                slug: "designing-for-conversion",
                excerpt: "A deep dive into the latest UI/UX trends that are actually driving measurable revenue increases.",
                content: "<h1>Micro-interactions matter</h1><p>In modern web design, the smallest details often have the biggest impact on your conversion funnel...</p>",
                published: true,
                authorId: authorId
            }
        ]);

        // 6. Update Site Settings (About text)
        console.log("Updating Site Settings (About Text)...");
        await db.update(siteSettings)
            .set({
                aboutText: "Optrizo Digital Solutions is a premier software development and product design agency. We specialize in partnering with bold companies to build high-performance web applications, striking brand identities, and custom digital infrastructure that drives real business growth. Based in the cloud, serving the world."
            })
            // Update the default row (ID 1)
            .where(eq(siteSettings.id, "1"));

        console.log("✅ CMS Mock Data Seed Complete!");
        process.exit(0);

    } catch (e) {
        console.error("❌ CMS Seed Failed: ", e);
        process.exit(1);
    }
}

main();
