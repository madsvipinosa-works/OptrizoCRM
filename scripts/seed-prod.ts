import "dotenv/config";
import { db } from "../src/db";
import { users, leads, agencyProjects, milestones, siteSettings, posts, projects, testimonials, aboutValues } from "../src/db/schema";

async function main() {
    console.log("🌱 Starting Production Seed...");

    try {
        // 1. Initialize Site Settings + About Page Content
        console.log("Setting up global site settings + About page content...");

        const companyStats = JSON.stringify([
            { label: "Projects Shipped", value: "120+" },
            { label: "Client Satisfaction", value: "98%" },
            { label: "Years in Business", value: "6" },
            { label: "Team Members", value: "14" },
        ]);

        const techStackItems = JSON.stringify([
            { name: "Next.js", imageUrl: "https://cdn.worldvectorlogo.com/logos/next-js.svg" },
            { name: "React", imageUrl: "https://cdn.worldvectorlogo.com/logos/react-2.svg" },
            { name: "TypeScript", imageUrl: "https://cdn.worldvectorlogo.com/logos/typescript.svg" },
            { name: "PostgreSQL", imageUrl: "https://cdn.worldvectorlogo.com/logos/postgresql.svg" },
            { name: "Vercel", imageUrl: "https://assets.vercel.com/image/upload/v1607554385/repositories/vercel/logo.png" },
            { name: "Tailwind CSS", imageUrl: "https://cdn.worldvectorlogo.com/logos/tailwind-css-2.svg" },
        ]);

        await db.insert(siteSettings).values({
            id: "1",
            heroTitle: "We Build the Products That Define Markets",
            heroDescription: "Optrizo is a premium digital product studio. We partner with founders, enterprises, and growth-stage companies to design, build, and scale web applications that deliver measurable business outcomes.",
            contactEmail: "hello@optrizo.com",
            monthlyMarketingSpend: 1500,
            adminHoursSavedPerProject: 4,
            // About Page
            aboutHeroTitle: "We Don't Just Build Software. We Build Leverage.",
            missionStatement: "Our mission is to close the gap between ambitious business ideas and flawless digital execution. Every product we ship is a direct extension of our client's competitive advantage — built to last, built to scale, and built to win.",
            companyStats,
            aboutTechStack: "Powered by the Industry's Most Trusted Stack",
            aboutTechStackItems: techStackItems,
            aboutCtaHeadline: "Ready to Build Something That Matters?",
            aboutCtaText: "Book a free 30-minute Discovery Call. We'll map out your problem, challenge your assumptions, and tell you exactly what it would take to solve it. No sales pitch. Just strategy.",
        }).onConflictDoUpdate({
            target: siteSettings.id,
            set: {
                heroTitle: "We Build the Products That Define Markets",
                heroDescription: "Optrizo is a premium digital product studio. We partner with founders, enterprises, and growth-stage companies to design, build, and scale web applications that deliver measurable business outcomes.",
                contactEmail: "hello@optrizo.com",
                aboutHeroTitle: "We Don't Just Build Software. We Build Leverage.",
                missionStatement: "Our mission is to close the gap between ambitious business ideas and flawless digital execution. Every product we ship is a direct extension of our client's competitive advantage — built to last, built to scale, and built to win.",
                companyStats,
                aboutTechStack: "Powered by the Industry's Most Trusted Stack",
                aboutTechStackItems: techStackItems,
                aboutCtaHeadline: "Ready to Build Something That Matters?",
                aboutCtaText: "Book a free 30-minute Discovery Call. We'll map out your problem, challenge your assumptions, and tell you exactly what it would take to solve it. No sales pitch. Just strategy.",
            }
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
            status: "Completed",
        }).returning({ id: leads.id });

        // 4. Create an Active Project
        console.log("Provisioning Active Mock Project...");
        const [mockProject] = await db.insert(agencyProjects).values({
            title: "Acme Corp Web Transformation",
            description: "Full stack rebuild using Next.js and Supabase.",
            leadId: mockLead.id,
            status: "In Progress"
        }).returning({ id: agencyProjects.id });

        const { projectStakeholders } = await import("../src/db/schema");
        await db.insert(projectStakeholders).values({
            projectId: mockProject.id,
            userId: mockClient.id
        });

        // 5. Build Project Milestones
        console.log("Injecting Project Milestones...");
        await db.insert(milestones).values([
            { projectId: mockProject.id, title: "Discovery & Wireframing", status: "Completed", order: 1 },
            { projectId: mockProject.id, title: "UI/UX Design", status: "In Progress", order: 2 },
            { projectId: mockProject.id, title: "Frontend Development", status: "Pending", order: 3 },
            { projectId: mockProject.id, title: "QA & Launch", status: "Pending", order: 4 },
        ]);

        // ─────────────────────────────────────────────────────────────────────
        // 6. BLOG POSTS (6 posts — published, SEO-ready)
        // ─────────────────────────────────────────────────────────────────────
        console.log("Seeding Blog Posts...");

        const blogPosts = [
            {
                title: "Why Your Business Needs a Custom Web App in 2025",
                slug: "why-your-business-needs-a-custom-web-app-2025",
                excerpt: "Off-the-shelf tools are slowing your team down. Here's why a purpose-built web application is the highest-ROI investment you can make this year.",
                coverImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=2672&auto=format&fit=crop",
                published: true,
                content: `<h2>The Hidden Cost of Generic Software</h2>
<p>Every minute your team works around the limitations of a one-size-fits-all SaaS tool is a minute of lost productivity. Custom web applications eliminate the friction between your workflow and the tools that support it.</p>
<h2>What a Custom Web App Actually Delivers</h2>
<p>Unlike off-the-shelf solutions, a purpose-built application is designed around your exact processes. It speaks your business language, integrates with your existing stack, and scales as you do — without per-seat licensing that punishes growth.</p>
<ul>
<li><strong>Automation of repetitive tasks</strong> your team does every day</li>
<li><strong>Real-time data dashboards</strong> tailored to your KPIs</li>
<li><strong>Seamless integrations</strong> with your CRM, ERP, or payment gateway</li>
<li><strong>Competitive moat</strong> — competitors can't replicate what they can't buy</li>
</ul>
<h2>When Does It Make Sense?</h2>
<p>If your team relies on more than 3 different SaaS tools that don't talk to each other, or if you find yourself exporting CSVs to do basic reporting, you are already a candidate. The breakeven point for most SMEs is 12–18 months — after which the application becomes a pure efficiency asset.</p>
<h2>The Optrizo Approach</h2>
<p>We begin every engagement with a 5-day Discovery Sprint. We map your current workflows, identify automation opportunities, and deliver a technical blueprint before a single line of code is written. You get clarity, not guesswork.</p>
<p>Ready to explore what's possible? <strong>Book a free discovery call</strong> with our team today.</p>`,
            },
            {
                title: "Next.js 15 vs Remix: Choosing the Right Framework for Your SaaS",
                slug: "nextjs-15-vs-remix-choosing-right-framework-saas-2025",
                excerpt: "A practical, opinionated breakdown of Next.js 15 and Remix for production SaaS applications — performance, DX, and deployment considerations.",
                coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2670&auto=format&fit=crop",
                published: true,
                content: `<h2>The Framework Decision That Will Define Your Product</h2>
<p>Choosing a web framework is a foundational architectural decision. Get it wrong and you'll be wrestling with limitations at the worst possible time — during your growth phase. Get it right and the framework disappears into the background, letting your product shine.</p>
<h2>Next.js 15: The Enterprise Standard</h2>
<p>With React Server Components, Partial Prerendering, and the App Router now stable, Next.js 15 is the most production-ready full-stack React framework available. Its strengths include:</p>
<ul>
<li><strong>Turbopack</strong> for lightning-fast local development</li>
<li><strong>Server Components</strong> — ship less JavaScript, load faster</li>
<li><strong>Edge-native</strong> — deploy globally on Vercel, Cloudflare, or AWS in minutes</li>
<li><strong>Largest ecosystem</strong> — every major third-party library supports Next.js first</li>
</ul>
<h2>Remix: The Underdog Worth Watching</h2>
<p>Remix takes a different philosophical stance. It embraces web fundamentals — HTML forms, HTTP, and progressive enhancement. The result is a framework that feels closer to the platform and less magical. It excels for content-heavy, form-driven applications.</p>
<h2>Our Recommendation</h2>
<p>For most SaaS products, we default to Next.js 15. The RSC model dramatically reduces Time to Interactive, server actions simplify data mutations, and the Vercel deployment pipeline is unmatched. We use Remix selectively for specific use cases — particularly multi-tenant B2B apps with complex nested routing needs.</p>
<p>The best framework is the one your team can ship fast with. We help you make this decision during Discovery, not after you've committed 10,000 lines of code.</p>`,
            },
            {
                title: "The Art of the Discovery Sprint: How We Plan Before We Build",
                slug: "art-of-the-discovery-sprint-how-we-plan-before-we-build",
                excerpt: "Most digital projects fail in planning, not execution. Our 5-day Discovery Sprint methodology reduces scope creep, eliminates misalignment, and accelerates delivery.",
                coverImage: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=2670&auto=format&fit=crop",
                published: true,
                content: `<h2>Why Projects Fail Before They Start</h2>
<p>The number one cause of failed digital projects is not bad code — it's bad planning. Vague requirements, unchallenged assumptions, and undefined success metrics create a swamp that even the best development team can't escape.</p>
<p>The Discovery Sprint is our answer to this systemic problem.</p>
<h2>What Happens in 5 Days</h2>
<p><strong>Day 1 — Stakeholder Mapping:</strong> We interview every key stakeholder. We ask uncomfortable questions. We find the real problem behind the stated problem.</p>
<p><strong>Day 2 — Workflow Archaeology:</strong> We document every current process, tool, and data flow. We find the bottlenecks, the redundancies, and the quick wins.</p>
<p><strong>Day 3 — Architecture Blueprint:</strong> Our engineers define the technical architecture. Database schema. API contracts. Third-party integrations. Infrastructure decisions.</p>
<p><strong>Day 4 — Prototype & Validation:</strong> Our designers build a clickable prototype of the core user flows. Real users test it. We capture feedback and iterate on the same day.</p>
<p><strong>Day 5 — Delivery & Alignment:</strong> We present the full Blueprint: architecture diagram, feature backlog, sprint plan, and a fixed-price engagement proposal.</p>
<h2>What You Get</h2>
<p>At the end of the Discovery Sprint, you own a complete technical and product document. You can take it to any development team. Most clients bring it back to us — because we built it with them.</p>`,
            },
            {
                title: "Database Design Decisions That Will Save You at Scale",
                slug: "database-design-decisions-that-will-save-you-at-scale",
                excerpt: "The schema decisions you make on Day 1 will either compound into a competitive advantage or a technical debt spiral. Here's how to get them right.",
                coverImage: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=2421&auto=format&fit=crop",
                published: true,
                content: `<h2>The Schema Is the Product</h2>
<p>In software, your database schema is your most important design document. Every feature you'll ever build has to work within its constraints. A well-designed schema is an asset. A poorly-designed one is a liability that compounds interest.</p>
<h2>Normalization vs. Pragmatism</h2>
<p>3NF (Third Normal Form) is the theoretical ideal — no data duplication, no anomalies. In practice, over-normalized schemas produce query complexity that kills developer velocity and database performance simultaneously.</p>
<p>Our rule of thumb: normalize to 3NF by default, then selectively denormalize for performance hotspots identified through real query analysis — not speculation.</p>
<h2>Junction Tables Over Arrays</h2>
<p>One of the most common mistakes we see in early-stage SaaS databases: storing relationships as JSON arrays in a column. This destroys queryability. A proper junction table with indexed foreign keys is almost always the right answer for many-to-many relationships.</p>
<h2>The Enum Trap</h2>
<p>Database enums feel clean — until your client asks you to add a new status type six months into production. We strongly prefer lookup tables or application-level constants over database enums for values that might evolve. Migrations on live data are painful. Careful upfront design prevents them.</p>
<h2>Indexing Strategy</h2>
<p>Add indexes on every foreign key. Add composite indexes on columns that always appear together in WHERE clauses. Never index columns with low cardinality (e.g., boolean flags). Run EXPLAIN ANALYZE on your top 10 queries before launch. These four rules will handle 90% of your performance needs.</p>`,
            },
            {
                title: "UX Principles That Actually Convert: Beyond Beautiful Design",
                slug: "ux-principles-that-actually-convert-beyond-beautiful-design",
                excerpt: "A stunning UI is table stakes. Conversion-optimized UX is the differentiator. We break down the principles that drive measurable business outcomes.",
                coverImage: "https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=2664&auto=format&fit=crop",
                published: true,
                content: `<h2>The Beautiful Trap</h2>
<p>We've audited hundreds of websites that win design awards and lose customers. A website can be visually stunning and functionally useless. Conversion-optimized UX requires a different lens: every design decision must be justified by user behavior data or established cognitive science principles.</p>
<h2>The Three-Second Rule</h2>
<p>A new visitor to your website will form a judgment in under three seconds. That judgment answers a single question: <em>"Is this for me?"</em> Your hero section's only job is to answer "yes" for your ideal client, instantly. Everything else is secondary.</p>
<h2>Cognitive Load Reduction</h2>
<p>Every choice you force a user to make consumes cognitive resources. Navigation menus with 12 items, forms with 20 fields, and walls of text all increase cognitive load and decrease conversion. The principle: if it doesn't contribute to the user's goal, remove it.</p>
<h2>The Progress Illusion</h2>
<p>Multi-step forms convert significantly better than single-page forms, even when they contain the same number of fields. Why? Because humans are loss-averse. Once they've completed Step 1 of 3, abandoning means losing progress. We use this principle in every lead capture form we build.</p>
<h2>Social Proof Architecture</h2>
<p>Testimonials placed below the fold, on a dedicated "Reviews" page, are largely invisible. The most effective social proof appears at the exact moment a user encounters an objection. Pricing page → client logos. Feature description → matching testimonial. Checkout → security badges. Proximity to the objection is what makes proof powerful.</p>`,
            },
            {
                title: "How We Reduced a Client's Infrastructure Cost by 67% With Edge Computing",
                slug: "how-we-reduced-client-infrastructure-cost-67-percent-edge-computing",
                excerpt: "A practical case study on migrating a traditional VPS-hosted Node.js API to a globally distributed Edge runtime — and the dramatic cost and performance results.",
                coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop",
                published: true,
                content: `<h2>The Problem: A Shrinking Margin</h2>
<p>Our client — a B2B SaaS company serving 4,000 active users — was spending $3,200/month on a dedicated server cluster to handle API traffic. With usage growing 20% month-over-month, they were facing an infrastructure cost that would outpace revenue growth within 18 months.</p>
<h2>The Analysis</h2>
<p>We instrumented their API layer and found a striking pattern: 78% of their API endpoints were read-heavy and nearly stateless. Only 22% involved complex business logic that required a traditional server environment. They were paying for a heavy-lift environment to run a lightweight workload.</p>
<h2>The Architecture Shift</h2>
<p>We migrated the 78% of read-heavy endpoints to Vercel Edge Functions — globally distributed, running on Cloudflare's network, with sub-100ms response times anywhere in the world. The remaining 22% of compute-intensive endpoints were refactored and moved to Vercel's Fluid compute.</p>
<h2>The Results — 60 Days Post-Launch</h2>
<ul>
<li><strong>Infrastructure cost:</strong> $3,200/month → $1,060/month (67% reduction)</li>
<li><strong>Global p95 latency:</strong> 380ms → 89ms</li>
<li><strong>Cold start time:</strong> Eliminated for edge functions</li>
<li><strong>Uptime:</strong> 99.97% (up from 99.81%)</li>
</ul>
<h2>The Lesson</h2>
<p>Not all compute is equal. The right architecture for your workload can dramatically reduce cost without sacrificing performance. Often, it improves it. The cost of an architecture audit is recovered in the first month of savings.</p>`,
            },
        ];

        for (const post of blogPosts) {
            await db.insert(posts).values(post).onConflictDoNothing();
        }
        console.log(`  ✓ Inserted ${blogPosts.length} blog posts.`);

        // ─────────────────────────────────────────────────────────────────────
        // 7. PORTFOLIO / CASE STUDIES (6 projects)
        // ─────────────────────────────────────────────────────────────────────
        console.log("Seeding Portfolio Projects...");

        const portfolioProjects = [
            {
                title: "NexaTrade — Institutional Trading Platform",
                slug: "nexatrade-institutional-trading-platform",
                clientName: "NexaTrade Financial",
                description: "A real-time institutional-grade trading interface handling 50,000+ orders per day, built from the ground up in 14 weeks.",
                coverImage: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=2670&auto=format&fit=crop",
                status: "published",
                content: `<h2>The Challenge</h2>
<p>NexaTrade's legacy trading platform was a 10-year-old Java monolith with a React frontend bolted on. It was crashing under load during peak market hours, causing significant financial and reputational damage to their institutional clients.</p>
<h2>Our Approach</h2>
<p>We conducted a one-week technical audit and proposed a strangler-fig migration — rebuilding the platform module by module while keeping the legacy system live. We prioritized the order execution engine and real-time price feed as the first modules to migrate.</p>
<h2>Technology Stack</h2>
<ul>
<li><strong>Frontend:</strong> Next.js 15 with App Router, React Server Components</li>
<li><strong>WebSockets:</strong> Ably for real-time price stream with &lt;10ms latency</li>
<li><strong>Backend:</strong> Node.js with tRPC for end-to-end type safety</li>
<li><strong>Database:</strong> PostgreSQL with TimescaleDB for time-series order data</li>
<li><strong>Infrastructure:</strong> Vercel + AWS RDS Multi-AZ</li>
</ul>
<h2>Results</h2>
<ul>
<li>99.99% uptime during market hours over 90 days post-launch</li>
<li>Order execution latency reduced from 420ms to 38ms</li>
<li>Platform now handles 50,000+ daily orders without degradation</li>
<li>NexaTrade onboarded 3 new institutional clients within 60 days of launch</li>
</ul>`,
            },
            {
                title: "GreenRoute — Logistics & Fleet Management SaaS",
                slug: "greenroute-logistics-fleet-management-saas",
                clientName: "GreenRoute Logistics",
                description: "An end-to-end fleet management platform replacing a spreadsheet-based operation for a 200-vehicle logistics company.",
                coverImage: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=2670&auto=format&fit=crop",
                status: "published",
                content: `<h2>The Challenge</h2>
<p>GreenRoute was managing a fleet of 200 vehicles across 6 provinces using a combination of WhatsApp groups, Excel spreadsheets, and phone calls. Dispatch errors, fuel theft, and missed deliveries were costing them an estimated $85,000 annually.</p>
<h2>What We Built</h2>
<p>A full-stack SaaS platform with three distinct interfaces: a Dispatcher Dashboard, a Driver Mobile App (PWA), and a Client Tracking Portal. All three surfaces share a single API and real-time data layer.</p>
<h2>Key Features Delivered</h2>
<ul>
<li><strong>Live GPS tracking</strong> with geofencing alerts for unauthorized route deviations</li>
<li><strong>Automated dispatch assignment</strong> using proximity and vehicle availability logic</li>
<li><strong>Digital proof of delivery</strong> — photo capture, signature, and timestamp, replacing paper PODs</li>
<li><strong>Fuel consumption analytics</strong> per vehicle, driver, and route — surfacing theft patterns</li>
<li><strong>Client self-service portal</strong> with live shipment tracking and delivery ETA</li>
</ul>
<h2>Outcome</h2>
<p>Within 90 days of deployment, GreenRoute reported a 34% reduction in dispatch errors and identified and terminated 3 drivers engaged in fuel fraud. The client portal reduced inbound "where is my delivery?" calls by 71%.</p>`,
            },
            {
                title: "Luminary CMS — Content Platform for Media Publishers",
                slug: "luminary-cms-content-platform-media-publishers",
                clientName: "Luminary Media Group",
                description: "A headless CMS and editorial workflow platform purpose-built for a multi-brand publisher managing 500+ articles per week.",
                coverImage: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2670&auto=format&fit=crop",
                status: "published",
                content: `<h2>The Problem With Generic CMS Tools</h2>
<p>Luminary Media Group was using WordPress across 5 of their brand properties. The result was 5 separate codebases, 5 plugin ecosystems to maintain, and no centralized content analytics. Their editorial team of 30 was spending more time managing CMS issues than creating content.</p>
<h2>The Solution: A Single Headless Platform</h2>
<p>We designed and built a bespoke headless CMS that serves all 5 brands from a single admin interface. Content creators write once and publish to any brand property with a single click. Brand-specific templates and styling are handled at the frontend layer, not the content layer.</p>
<h2>Editorial Workflow Engine</h2>
<p>The most complex piece was the multi-stage editorial workflow. Articles flow through Draft → Review → Legal Approval → Scheduled → Published states, with role-based permissions at every stage. Editors can leave inline comments on specific paragraphs, creating a Google Docs-like collaboration experience within the CMS.</p>
<h2>Performance Impact</h2>
<p>Since each brand's frontend is a Next.js static site powered by the headless API, page load times dropped from an average of 4.2 seconds (WordPress) to 0.8 seconds (Next.js ISR). Core Web Vitals went from red to green across all 5 properties within 30 days of launch.</p>`,
            },
            {
                title: "Vaulta — Personal Finance & Budgeting Application",
                slug: "vaulta-personal-finance-budgeting-application",
                clientName: "Vaulta Fintech Inc.",
                description: "A consumer-facing personal finance application with bank-grade security, AI-powered spend categorization, and real-time budget alerts.",
                coverImage: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?q=80&w=2671&auto=format&fit=crop",
                status: "published",
                content: `<h2>Building for Financial Trust</h2>
<p>Financial applications live and die on trust. Users entrust you with their most sensitive data — bank accounts, transaction history, spending habits. Before we wrote a single feature, we spent two weeks on security architecture, compliance requirements, and data encryption strategy.</p>
<h2>Security Architecture</h2>
<ul>
<li><strong>Bank connections:</strong> Plaid API with read-only OAuth tokens — we never store bank credentials</li>
<li><strong>Data encryption:</strong> AES-256 at rest, TLS 1.3 in transit</li>
<li><strong>Authentication:</strong> Passkey-first (WebAuthn) with TOTP fallback</li>
<li><strong>Audit logging:</strong> Every data access event logged and immutable</li>
</ul>
<h2>AI Categorization Engine</h2>
<p>The breakthrough feature was our AI-powered transaction categorization. Using a fine-tuned GPT model trained on anonymized transaction data, the system achieves 94% categorization accuracy out of the box — and learns from user corrections to improve over time.</p>
<h2>Traction</h2>
<p>Vaulta launched to a waitlist of 12,000 users. Within 90 days, they had 8,400 active users, a 4.7-star App Store rating, and were featured in two major fintech publications. They closed a $1.2M seed round 4 months post-launch.</p>`,
            },
            {
                title: "Skoolar — University Course Management Platform",
                slug: "skoolar-university-course-management-platform",
                clientName: "Skoolar EdTech",
                description: "A full-featured LMS replacing a university's legacy Moodle implementation for 15,000 students and 400 faculty members.",
                coverImage: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=2671&auto=format&fit=crop",
                status: "published",
                content: `<h2>The Moodle Migration Problem</h2>
<p>Moodle has been the default LMS for universities for two decades — and two decades of technical debt shows. The university's instance was hosted on aging on-premise servers, required 6 hours of maintenance downtime monthly, and had a UX that students openly complained about in semester feedback.</p>
<h2>Scope of the Engagement</h2>
<p>This was our largest single engagement to date: a 9-month project with a team of 8, replacing an LMS used by 15,000 students, 400 faculty, and 60 admin staff. Data migration alone — 8 years of course content, grades, and user data — was a 6-week workstream.</p>
<h2>What We Replaced and What We Rebuilt</h2>
<p>We preserved what worked (the course structure model and assessment framework) and rebuilt everything else. The new interface is mobile-first, loads in under 1 second on 3G, and passes WCAG 2.1 AA accessibility standards — a requirement that Moodle failed to meet.</p>
<h2>Key Innovations</h2>
<ul>
<li><strong>AI-assisted grading</strong> for short-answer questions, with faculty review workflow</li>
<li><strong>Live attendance tracking</strong> via QR code check-in on student mobile devices</li>
<li><strong>Predictive at-risk alerts</strong> — flags students showing early disengagement patterns based on login frequency, submission timing, and grade trajectory</li>
</ul>
<h2>Launch Results</h2>
<p>Semester 1 post-launch: 89% student satisfaction vs. 54% for Moodle. Faculty ticket volume dropped 62%. The university eliminated their $140,000/year server maintenance contract.</p>`,
            },
            {
                title: "PulseHR — Workforce Analytics & HRIS Dashboard",
                slug: "pulsehr-workforce-analytics-hris-dashboard",
                clientName: "PulseHR Solutions",
                description: "A real-time HR analytics dashboard integrating with 6 different HRIS sources to give People teams a unified view of their workforce data.",
                coverImage: "https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=2670&auto=format&fit=crop",
                status: "published",
                content: `<h2>The Fragmented HR Data Problem</h2>
<p>The average mid-size company uses 3–6 different HR tools: an ATS, a payroll provider, a performance management platform, an LMS, and a time-tracking system. None of them talk to each other. People leaders are left manually exporting and reconciling data in Excel — a process that takes days and produces stale insights.</p>
<h2>The Integration Challenge</h2>
<p>PulseHR required native integrations with Workday, BambooHR, ADP, Greenhouse, Lattice, and Rippling. Each has a different API paradigm — REST, GraphQL, SOAP, and webhook-based. We built a unified data ingestion layer with provider-agnostic normalization that transforms each source into a consistent internal schema.</p>
<h2>Real-Time Analytics Engine</h2>
<p>The dashboard is powered by a materialized view architecture in PostgreSQL, refreshed every 15 minutes. This gives People teams real-time workforce metrics — headcount by department, attrition risk scores, time-to-hire by role, and compensation band analysis — without the complexity of a full data warehouse.</p>
<h2>Privacy-First Design</h2>
<p>HR data is sensitive. We implemented role-based data visibility (a manager can only see their own team's data), full audit logging of all data access, and a one-click data export for GDPR compliance. Privacy was designed in from Day 1, not bolted on as an afterthought.</p>
<h2>Business Impact</h2>
<p>PulseHR's clients report saving an average of 12 hours per week on People operations reporting. Three enterprise clients credited PulseHR dashboards with identifying attrition risk that allowed them to intervene before losing a key employee.</p>`,
            },
        ];

        for (const project of portfolioProjects) {
            await db.insert(projects).values(project).onConflictDoNothing();
        }
        console.log(`  ✓ Inserted ${portfolioProjects.length} portfolio case studies.`);

        // ─────────────────────────────────────────────────────────────────────
        // 8. TESTIMONIALS (8 clients)
        // ─────────────────────────────────────────────────────────────────────
        console.log("Seeding Testimonials...");

        const clientTestimonials = [
            {
                name: "Marcus Hendricks",
                role: "CTO",
                company: "NexaTrade Financial",
                content: "Optrizo delivered what three previous agencies told us was impossible — a complete platform rebuild without business disruption. They moved our entire trading infrastructure to a modern stack while we stayed live. Response times went from 420ms to under 40ms. The ROI on this engagement was visible within 60 days.",
                rating: 5,
                image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
                active: true,
            },
            {
                name: "Sofia Reyes",
                role: "CEO",
                company: "Vaulta Fintech Inc.",
                content: "We chose Optrizo because they were the only team that asked about our security architecture before asking about our budget. That told us everything. They built Vaulta with a security-first mindset that gave us the confidence to raise our seed round. Investors specifically called out the product quality during due diligence.",
                rating: 5,
                image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
                active: true,
            },
            {
                name: "Daniel Okafor",
                role: "Head of Operations",
                company: "GreenRoute Logistics",
                content: "Before Optrizo, we were running a 200-vehicle operation on WhatsApp and Excel. I know how that sounds. Within 30 days of launching our new platform, we'd identified three drivers stealing fuel — something we'd suspected for years but couldn't prove. The platform paid for itself in the first month.",
                rating: 5,
                image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop",
                active: true,
            },
            {
                name: "Priya Nandakumar",
                role: "VP of Engineering",
                company: "Skoolar EdTech",
                content: "The Skoolar migration was our most ambitious internal project ever. Optrizo handled the technical complexity brilliantly, but what impressed us most was their communication. We had a weekly status call that was always honest, always specific, and always actionable. Not once did I feel like I was being managed. I was being partnered with.",
                rating: 5,
                image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop",
                active: true,
            },
            {
                name: "James Cartwright",
                role: "Head of Editorial",
                company: "Luminary Media Group",
                content: "Our editorial team publishes 500+ articles a week across five brands. The old WordPress setup was a constant source of fires. Optrizo built us a CMS that our writers actually enjoy using — that alone is remarkable. Page speed went from 4 seconds to under a second. Our SEO rankings improved without us changing a single content strategy.",
                rating: 5,
                image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop",
                active: true,
            },
            {
                name: "Lena Vasquez",
                role: "Director of People & Culture",
                company: "Meridian Group",
                content: "I used to spend every Monday morning reconciling HR data from four different systems. PulseHR, built by Optrizo, eliminated that entirely. I now walk into Monday with a live dashboard that tells me everything I need to know about my workforce. The time I've saved goes directly into the work that actually matters — talking to people.",
                rating: 5,
                image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=200&auto=format&fit=crop",
                active: true,
            },
            {
                name: "Raymond Tiu",
                role: "Founder",
                company: "BuildFast Startup Studio",
                content: "We've worked with six development agencies. Optrizo is the only one that has ever pushed back on a requirement — and been right every single time they did. They don't just execute; they think. Their Discovery Sprint saved us from building a feature that would have confused our users. That kind of strategic input is what separates a vendor from a partner.",
                rating: 5,
                image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=200&auto=format&fit=crop",
                active: true,
            },
            {
                name: "Camille Fontaine",
                role: "Chief Product Officer",
                company: "HealthSync Digital",
                content: "Healthcare software has zero tolerance for errors. Optrizo understood this from day one. Their QA process — automated testing, accessibility compliance, HIPAA data handling — was more thorough than anything I've seen at a 10x larger agency. They delivered on time, within budget, and without the usual last-week panic. I will never use another agency for our core product work.",
                rating: 5,
                image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop",
                active: true,
            },
        ];

        await db.insert(testimonials).values(clientTestimonials).onConflictDoNothing();
        console.log(`  ✓ Inserted ${clientTestimonials.length} testimonials.`);

        // ─────────────────────────────────────────────────────────────────────
        // 9. ABOUT PAGE — CORE VALUES (Bento Grid Cards)
        // ─────────────────────────────────────────────────────────────────────
        console.log("Seeding About Page Core Values...");

        const coreValues = [
            {
                title: "Craftsmanship Over Convention",
                description: "We don't cut corners, copy templates, or settle for 'good enough.' Every interface, every API, and every database query is built with intentional care. Our standard is: would we be proud to put our name on this in five years? If not, we rebuild it.",
                icon: "Gem",
                order: 1,
            },
            {
                title: "Radical Transparency",
                description: "No hidden blockers, no sugar-coating, no project management theater. We tell clients the truth — even when it's uncomfortable — because real partnership is built on honest communication.",
                icon: "Eye",
                order: 2,
            },
            {
                title: "Measurable Outcomes",
                description: "A beautiful product that doesn't move business metrics is just art. We define success in terms our clients actually care about: leads generated, time saved, revenue unlocked.",
                icon: "TrendingUp",
                order: 3,
            },
            {
                title: "Security by Default",
                description: "Security is never an afterthought. Every application we build is designed with encryption, access control, and audit logging as first-class requirements — not features added at the end.",
                icon: "ShieldCheck",
                order: 4,
            },
            {
                title: "Performance is a Feature",
                description: "A slow application is a broken application. We obsess over Core Web Vitals, database query plans, and edge caching strategies because performance directly correlates to conversion and trust.",
                icon: "Zap",
                order: 5,
            },
            {
                title: "Long-Term Partnership",
                description: "We don't disappear after launch. Our most successful client relationships span years — we become the trusted technical arm of their business, helping them navigate growth, pivots, and new opportunities.",
                icon: "Handshake",
                order: 6,
            },
        ];

        // Wipe existing values before re-seeding to avoid duplicates
        const { aboutValues: aboutValuesTable } = await import("../src/db/schema");
        for (const value of coreValues) {
            await db.insert(aboutValuesTable).values(value).onConflictDoNothing();
        }
        console.log(`  ✓ Inserted ${coreValues.length} core value cards.`);

        console.log("\n✅ Production Seed Complete! All content is live.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Seed Failed: ", e);
        process.exit(1);
    }
}

main();
