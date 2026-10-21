import "dotenv/config";
import { db } from "../src/db";
import {
    users,
    inquiries,
    leads,
    leadAssignees,
    leadActivityLogs,
    crmTasks,
    proposals,
    agencyProjects,
    projectStakeholders,
    milestones,
    tasks,
    taskAssignees,
    taskSubmissions,
    clientFeedback,
    auditLogs,
    notifications,
    services,
    type ProjectDocumentItem
} from "../src/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function seedDemoAccounts() {
    console.log("🌱 [Seed Demo] Starting Rich Demo Account & Mock Data Generation...");

    const DEMO_PASSWORD_HASH = await bcrypt.hash("Password123!", 10);

    // ==========================================
    // 1. UPSERT DEMO ADMIN & CLIENT USERS
    // ==========================================
    console.log("👤 Creating or updating demo accounts...");

    // 1.1 Admin Account (admin@optrizo.com)
    let [admin] = await db.select().from(users).where(eq(users.email, "admin@optrizo.com")).limit(1);
    if (!admin) {
        const [createdAdmin] = await db.insert(users).values({
            name: "Optrizo Super Admin",
            email: "admin@optrizo.com",
            password: DEMO_PASSWORD_HASH,
            role: "superadmin",
            jobTitle: "Lead Solutions Architect & Agency Director",
            companyName: "Optrizo Digital Solutions",
            isActive: true,
            emailVerified: new Date(),
            showOnAboutPage: true
        }).returning();
        admin = createdAdmin;
        console.log("   ✅ Created demo admin: admin@optrizo.com (ID: " + admin.id + ")");
    } else {
        await db.update(users).set({
            password: DEMO_PASSWORD_HASH,
            role: "superadmin",
            isActive: true,
            name: "Optrizo Super Admin",
            jobTitle: "Lead Solutions Architect & Agency Director"
        }).where(eq(users.id, admin.id));
        console.log("   🔄 Updated demo admin credentials: admin@optrizo.com");
    }

    // 1.2 Client Account (client@optrizo.com)
    let [client] = await db.select().from(users).where(eq(users.email, "client@optrizo.com")).limit(1);
    if (!client) {
        const [createdClient] = await db.insert(users).values({
            name: "Elena Rostova",
            email: "client@optrizo.com",
            password: DEMO_PASSWORD_HASH,
            role: "client",
            jobTitle: "Chief Technology Officer",
            companyName: "Nexora Health Technologies",
            industry: "HealthTech & Telemedicine",
            isActive: true,
            emailVerified: new Date(),
            showOnAboutPage: false
        }).returning();
        client = createdClient;
        console.log("   ✅ Created demo client: client@optrizo.com (ID: " + client.id + ")");
    } else {
        await db.update(users).set({
            password: DEMO_PASSWORD_HASH,
            role: "client",
            isActive: true,
            name: "Elena Rostova",
            companyName: "Nexora Health Technologies",
            jobTitle: "Chief Technology Officer",
            industry: "HealthTech & Telemedicine"
        }).where(eq(users.id, client.id));
        console.log("   🔄 Updated demo client credentials: client@optrizo.com");
    }

    // ==========================================
    // 2. CLEAN UP PREVIOUS DEMO ENTITIES (FOR REPRODUCIBLE FRESH STATE)
    // ==========================================
    console.log("🧹 Resetting previous demo entities for fresh, clean state...");
    
    // Find old demo projects and delete them
    const existingProjects = await db.select().from(agencyProjects).where(
        or(
            eq(agencyProjects.title, "Nexora Health - Telemedicine & Client Portal Platform"),
            eq(agencyProjects.title, "Nexora Health Platform")
        )
    );
    for (const p of existingProjects) {
        await db.delete(agencyProjects).where(eq(agencyProjects.id, p.id));
    }

    // Find old demo leads and delete them
    const existingLeads = await db.select().from(leads).where(
        or(
            eq(leads.contactEmail, "client@optrizo.com"),
            eq(leads.businessName, "Nexora Health Technologies")
        )
    );
    for (const l of existingLeads) {
        await db.delete(leads).where(eq(leads.id, l.id));
    }

    // Delete old demo inquiries
    await db.delete(inquiries).where(eq(inquiries.email, "client@optrizo.com"));

    // Clean up notifications for demo accounts
    await db.delete(notifications).where(
        or(
            eq(notifications.userId, client.id),
            eq(notifications.userId, admin.id)
        )
    );

    // ==========================================
    // 3. TARGET SERVICE
    // ==========================================
    let [service] = await db.select().from(services).limit(1);
    if (!service) {
        const [createdService] = await db.insert(services).values({
            title: "Custom Web App Development",
            description: "High-performance full-stack web applications with Next.js, real-time dispatch, and automated quality gates.",
            icon: "Laptop",
            category: "Web Development",
            order: 1,
            isFeatured: true
        }).returning();
        service = createdService;
    }

    // ==========================================
    // 4. SEED CRM: INQUIRY -> LEAD -> PROPOSALS -> CRM TASKS
    // ==========================================
    console.log("💼 Seeding rich CRM pipeline (Inquiry, Lead, SOW Proposals, CRM Tasks, Activity Logs)...");

    // 4.1 Inbound Website Inquiries
    await db.insert(inquiries).values({
        name: "Elena Rostova",
        email: "client@optrizo.com",
        subject: "Nexora Telehealth Portal & Patient Dispatch Platform",
        message: "We need an enterprise-grade web application to handle patient-doctor appointment dispatching, automated medical intake forms, and an external Client Portal for our healthcare partners. We require sub-100ms API latency, full HIPAA compliance, and a verifiable deliverable approval process for executive sign-offs.",
        status: "Read",
        source: "Website Form",
        ownerId: admin.id,
        isHandled: true,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    });

    // Additional realistic context inquiry from another client for dashboard variety
    const [existingSampleInquiry] = await db.select().from(inquiries).where(eq(inquiries.email, "marcus.vance@apexlogistics.io")).limit(1);
    if (!existingSampleInquiry) {
        await db.insert(inquiries).values({
            name: "Marcus Vance",
            email: "marcus.vance@apexlogistics.io",
            subject: "Fleet Tracking & Supply Chain Telemetry Dashboard",
            message: "Looking for a modern Next.js real-time analytics dashboard to track 450+ freight vehicles across Southeast Asia with GPS websocket streaming.",
            status: "Unread",
            source: "Website Form",
            isHandled: false,
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        });
    }

    // 4.2 Qualified Sales Lead (Closed Won - Nexora Health)
    const [demoLead] = await db.insert(leads).values({
        clientId: client.id,
        serviceId: service.id,
        businessName: "Nexora Health Technologies",
        contactName: "Elena Rostova",
        contactEmail: "client@optrizo.com",
        contactPhone: "+1 (555) 349-8821",
        budget: "$35,000 - $55,000",
        estimatedValue: 35000,
        leadScore: 96,
        priority: "Hot",
        status: "Closed Won",
        qualificationStatus: "SQL",
        source: "Client Portal Intake",
        industry: "HealthTech & Telemedicine",
        companySize: "50-200 Employees",
        goals: "Deploy an automated, responsive healthcare portal with authenticated client asset review, automated Definition of Done proof gates, and sprint velocity tracking.",
        timelineExpectation: "8 Weeks (3 Agile Sprints)",
        requirementsSummary: "HIPAA-compliant patient portal, doctor scheduling engine with concurrency conflict matrix, WebRTC video consultation room, and external executive review dashboard.",
        notes: "Technical evaluation conducted with CTO Elena Rostova. Client selected Optrizo for our automated DoD quality gate verification and transparent milestone-based delivery.",
        lastContactedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        nextFollowUpDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        isArchived: false,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    }).returning();
    console.log("   ✅ Created Demo Lead: Nexora Health Technologies (Closed Won, $35k)");

    // 4.3 Assign Super Admin as Lead Owner
    await db.insert(leadAssignees).values({
        leadId: demoLead.id,
        userId: admin.id
    });

    // 4.4 Lead Activity Logs (Chronological History)
    await db.insert(leadActivityLogs).values([
        {
            leadId: demoLead.id,
            authorId: admin.id,
            activityType: "Call",
            content: "Conducted initial technical discovery call (45 mins) with CTO Elena Rostova. Documented compliance criteria, appointment scheduling volume, and target launch window.",
            createdAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000)
        },
        {
            leadId: demoLead.id,
            authorId: admin.id,
            activityType: "Meeting",
            content: "Technical Architecture Review meeting. Evaluated Nexora EHR sandbox API specifications and agreed on Next.js 16 App Router + PostgreSQL Drizzle 3NF stack.",
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
        },
        {
            leadId: demoLead.id,
            authorId: admin.id,
            activityType: "Note",
            content: "Executed AI Scope Deconstructor on requirements brief. Decomposed project into 3 distinct sprints with verifiable deliverables and compiled SOW Proposal OPT-2026-1042 ($35,000).",
            createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
        },
        {
            leadId: demoLead.id,
            authorId: null, // System event
            activityType: "System",
            content: "Proposal OPT-2026-1042 was digitally signed and accepted by Elena Rostova (CTO) from IP 198.51.100.42. Deal automatically converted to Closed Won.",
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        },
        {
            leadId: demoLead.id,
            authorId: admin.id,
            activityType: "Email",
            content: "Dispatched Phase 2 Addendum Proposal OPT-2026-1088 ($18,500) covering AI Clinical Triage and Automated Patient SMS notifications to Elena Rostova.",
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        }
    ]);

    // 4.5 CRM Follow-Up Tasks
    await db.insert(crmTasks).values([
        {
            leadId: demoLead.id,
            assignedTo: admin.id,
            title: "Review BAA & HIPAA Security Compliance Checklist",
            description: "Finalize Business Associate Agreement (BAA) countersignatures and attach to client document repository.",
            taskType: "To-do",
            status: "Completed",
            priority: "High",
            dueDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
        },
        {
            leadId: demoLead.id,
            assignedTo: admin.id,
            title: "Sprint 2 Mid-Sprint Stakeholder Demo with Elena Rostova",
            description: "Demonstrate live appointment calendar scheduling conflict detection on staging environment.",
            taskType: "Meeting",
            status: "Pending",
            priority: "High",
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        },
        {
            leadId: demoLead.id,
            assignedTo: admin.id,
            title: "Follow up on Phase 2 Addendum Proposal Signature (OPT-2026-1088)",
            description: "Check in with Elena regarding the AI Clinical Triage scope and answer any HL7/FHIR integration questions.",
            taskType: "Email",
            status: "Pending",
            priority: "Medium",
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        }
    ]);

    // 4.6 SOW Proposals (Proposal 1: Executed Contract, Proposal 2: Pending Digital Signature)
    
    // Proposal 1: Core Platform (Approved & Signed)
    const [prop1] = await db.insert(proposals).values({
        leadId: demoLead.id,
        proposalCode: "OPT-2026-1042",
        scope: "Full-Stack Architecture, Engineering, Quality Gates, and Cloud Deployment of the Nexora Health Telemedicine Web Platform.",
        technicalApproach: "Engineered using Next.js 16 App Router with serverless Edge dispatch, Tailwind CSS design system tokens, PostgreSQL relational schema via Drizzle ORM, Twilio WebRTC video consultation rooms, and automated Definition of Done quality gates.",
        deliverables: [
            { 
                title: "Sprint 1: Architecture, 3NF Data Schema & UI/UX Design System", 
                spec: "Comprehensive Figma design system with 25 responsive screens, design tokens, and normalized 3NF PostgreSQL relational database migrations." 
            },
            { 
                title: "Sprint 2: Core Engineering, Scheduling Engine & Client Portal", 
                spec: "Real-time doctor appointment booking engine with concurrency conflict detection, role-segregated Client Portal with deliverable approval workflows." 
            },
            { 
                title: "Sprint 3: Quality Gates, Security Hardening & Production Cloud Handover", 
                spec: "Automated DoD pull request verification, OWASP Top 10 penetration audit, TLS 1.3 encryption, and zero-downtime Vercel production deployment." 
            }
        ],
        timeline: "8 Weeks across 3 Agile Sprints",
        pricingStructure: [
            { milestone: "Sprint 1: Architecture & UI/UX Design System", cost: 10000 },
            { milestone: "Sprint 2: Core Engineering & Scheduling Engine", cost: 15000 },
            { milestone: "Sprint 3: Quality Gates, QA & Cloud Handover", cost: 10000 }
        ],
        subtotal: 35000,
        discount: 0,
        tax: 0,
        total: 35000,
        terms: "Net 30 milestone disbursement schedule. Full 100% intellectual property and source code handover upon final sprint delivery. SLA guarantees 99.9% application uptime.",
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: "Approved",
        acceptedByName: "Elena Rostova",
        acceptedByEmail: "client@optrizo.com",
        acceptedByTitle: "Chief Technology Officer",
        signatureData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        acceptedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        acceptedIp: "198.51.100.42",
        acceptedUserAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        contractSettings: {
            clientAddress: "742 Innovation Way, Suite 400, San Francisco, CA 94105",
            clientPhone: "+1 (555) 349-8821",
            clientContactPerson: "Elena Rostova (CTO)",
            agencyAddress: "Optrizo Digital Solutions, High Street South, Bonifacio Global City, Taguig",
            agencyPhone: "+63 (2) 8888-OPTR",
            governingLaw: "State of California, United States",
            paymentMethod: "Automated Wire Transfer / Stripe Invoicing (Net 30)",
            includeConfidentiality: true,
            includeIpClause: true,
            includeLiabilityClause: true,
            includeChangeOrder: true,
            includeDisputeResolution: true,
            customClauses: "All source code, database schemas, and intellectual property transfer immediately to Nexora Health Technologies upon final milestone disbursement."
        }
    }).returning();
    console.log("   ✅ Created SOW Proposal: OPT-2026-1042 (Approved & Digitally Signed)");

    // Proposal 2: Phase 2 Addendum (Sent / Pending Signature - showcases the interactive signing experience!)
    const [prop2] = await db.insert(proposals).values({
        leadId: demoLead.id,
        proposalCode: "OPT-2026-1088",
        scope: "Phase 2 Addendum: AI-Powered Clinical Triage Assistant & Automated Patient Follow-up Pipeline.",
        technicalApproach: "Integration of Gemini AI triage intake questionnaire with physician approval loop, Twilio automated SMS appointment dispatching, and HL7/FHIR EHR electronic medical records synchronization.",
        deliverables: [
            { 
                title: "Deliverable 2.1: AI Clinical Triage Intake Engine", 
                spec: "Interactive patient intake assistant that summarizes preliminary symptoms for the attending physician with structured clinical codes." 
            },
            { 
                title: "Deliverable 2.2: Automated SMS & Email Notification Pipeline", 
                spec: "Event-driven reminder engine delivering calendar invites, intake reminders 24h prior, and post-consultation prescription download links." 
            },
            { 
                title: "Deliverable 2.3: EHR Sandbox HL7/FHIR Connector", 
                spec: "Secure, encrypted data bridge to sync consultation summaries with hospital EHR records." 
            }
        ],
        timeline: "4 Weeks across 2 Agile Sprints",
        pricingStructure: [
            { milestone: "Sprint 1: AI Clinical Triage & Intake Form", cost: 9500 },
            { milestone: "Sprint 2: FHIR EHR Bridge & Automated SMS Dispatch", cost: 9000 }
        ],
        subtotal: 18500,
        discount: 0,
        tax: 0,
        total: 18500,
        terms: "Addendum to Master Services Agreement OPT-2026-1042. 50% upon kickoff, 50% upon final acceptance.",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "Sent",
        contractSettings: {
            clientAddress: "742 Innovation Way, Suite 400, San Francisco, CA 94105",
            clientPhone: "+1 (555) 349-8821",
            clientContactPerson: "Elena Rostova (CTO)",
            agencyAddress: "Optrizo Digital Solutions, High Street South, Bonifacio Global City, Taguig",
            agencyPhone: "+63 (2) 8888-OPTR",
            governingLaw: "State of California, United States",
            paymentMethod: "Automated Wire Transfer / Stripe Invoicing (Net 30)",
            includeConfidentiality: true,
            includeIpClause: true,
            includeLiabilityClause: true,
            includeChangeOrder: true,
            includeDisputeResolution: true,
            customClauses: "Addendum inherits all security, confidentiality, and IP assignment clauses established in primary agreement OPT-2026-1042."
        }
    }).returning();
    console.log("   ✅ Created SOW Proposal: OPT-2026-1088 (Sent / Ready for Interactive Digital Signature)");

    // ==========================================
    // 5. SEED PROJECT MANAGEMENT (PM) WORKFLOW
    // ==========================================
    console.log("📊 Seeding rich Project Management ecosystem (Project, Milestones, Tasks, Documents, Staging, DoD Gates, Feedback)...");

    // 5.1 Project Entity with Rich Staging & Document Metadata
    const sampleDocuments: ProjectDocumentItem[] = [
        {
            id: crypto.randomUUID(),
            title: "Nexora HIPAA Security Architecture & Data Flow Diagram.pdf",
            url: "https://storage.optrizo.com/docs/nexora-architecture-v1.2.pdf",
            type: "pdf",
            sizeBytes: 3355443, // 3.2 MB
            uploadedById: admin.id,
            uploadedByName: "Optrizo Super Admin",
            uploadedByRole: "agency",
            createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: crypto.randomUUID(),
            title: "Nexora Design System & High-Fidelity Figma Tokens",
            url: "https://figma.com/@optrizo/nexora-telehealth-design-system",
            type: "figma",
            sizeBytes: 0,
            uploadedById: admin.id,
            uploadedByName: "Optrizo Super Admin",
            uploadedByRole: "agency",
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: crypto.randomUUID(),
            title: "OpenAPI 3.1 REST & WebSocket Event Dispatch Specification.doc",
            url: "https://storage.optrizo.com/docs/nexora-api-spec.docx",
            type: "doc",
            sizeBytes: 1572864, // 1.5 MB
            uploadedById: admin.id,
            uploadedByName: "Optrizo Super Admin",
            uploadedByRole: "agency",
            createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: crypto.randomUUID(),
            title: "Nexora EHR Integration API Credentials & Sandbox Spec.pdf",
            url: "https://storage.optrizo.com/docs/nexora-ehr-sandbox.pdf",
            type: "pdf",
            sizeBytes: 1153433, // 1.1 MB
            uploadedById: client.id,
            uploadedByName: "Elena Rostova",
            uploadedByRole: "client",
            createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: crypto.randomUUID(),
            title: "Nexora Brand Guidelines & SVG Asset Kit.zip",
            url: "https://storage.optrizo.com/docs/nexora-brand-assets.zip",
            type: "zip",
            sizeBytes: 8808038, // 8.4 MB
            uploadedById: client.id,
            uploadedByName: "Elena Rostova",
            uploadedByRole: "client",
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
    ];

    const [project] = await db.insert(agencyProjects).values({
        title: "Nexora Health - Telemedicine & Client Portal Platform",
        description: "Enterprise full-stack healthcare web application featuring real-time appointment scheduling, physician video dispatching, role-segregated Client Portal, and automated Definition of Done quality gates.",
        sourceBrief: "Nexora Health Technologies requires an enterprise web portal allowing patients to book video consultations with licensed specialists, submit digital intake histories, and receive automated prescriptions. The platform must adhere to HIPAA security standards, achieve sub-100ms API response latency, and feature an external Client Portal for executive stakeholder milestone review and deliverable sign-offs.",
        leadId: demoLead.id,
        status: "In Progress",
        startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days ahead
        stagingUrls: [
            "https://nexora-staging.optrizo.dev (Live Staging Vercel Edge Build #42)",
            "https://figma.com/@optrizo/nexora-telehealth-design-system",
            "https://api.nexora-staging.optrizo.dev/api/v1/docs (OpenAPI / Swagger)"
        ],
        documents: sampleDocuments,
        isArchived: false,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    }).returning();
    console.log("   ✅ Created Project: " + project.title);

    // 5.2 Associate Client to Project (Crucial for Client Portal Access!)
    await db.insert(projectStakeholders).values({
        projectId: project.id,
        userId: client.id
    });
    console.log("   🔗 Linked Client Elena Rostova (client@optrizo.com) to Project in project_stakeholder");

    // 5.3 Milestones (Sprint 1: Completed, Sprint 2: Client Approval, Sprint 3: In Progress)
    const [m1] = await db.insert(milestones).values({
        projectId: project.id,
        title: "Sprint 1: Architecture, 3NF Data Schema & UI/UX Design System",
        status: "Completed",
        order: 1,
        completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    }).returning();

    const [m2] = await db.insert(milestones).values({
        projectId: project.id,
        title: "Sprint 2: Core Engineering, Scheduling Engine & Client Portal",
        status: "Client Approval", // Interactive approval trigger in Client Portal!
        order: 2,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }).returning();

    const [m3] = await db.insert(milestones).values({
        projectId: project.id,
        title: "Sprint 3: Quality Gates, Security Hardening & Production Cloud Handover",
        status: "In Progress",
        order: 3,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }).returning();

    // 5.4 Tasks with Fibonacci Weights (1, 2, 3, 5)
    
    // --- Sprint 1 Tasks (Completed - 8 total points) ---
    const [t1] = await db.insert(tasks).values({
        projectId: project.id,
        milestoneId: m1.id,
        title: "Design High-Fidelity Figma Wireframes & Design Tokens",
        description: "Develop 25 responsive mobile and desktop screen prototypes with unified design system tokens, WCAG AA color contrasts, and accessibility guidelines.",
        weight: 3,
        status: "Done",
        requiresProof: true,
        proofLinks: [{ label: "Figma Prototype", url: "https://figma.com/@optrizo/nexora-telehealth-design-system" }],
        proofNotes: "25 responsive screen prototypes finalized and signed off by Elena Rostova during Sprint 1 review.",
        completedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    }).returning();

    const [t2] = await db.insert(tasks).values({
        projectId: project.id,
        milestoneId: m1.id,
        title: "Implement PostgreSQL Relational Schema & 3NF Drizzle Migrations",
        description: "Configure normalized database schema across all operational modules with cascade integrity, primary keys, and index optimizations.",
        weight: 5,
        status: "Done",
        requiresProof: true,
        proofLinks: [{ label: "GitHub PR #1", url: "https://github.com/optrizo/nexora-health/pull/1" }],
        proofNotes: "All 29 tables successfully migrated, foreign keys verified, and automated unit test suite passed.",
        completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }).returning();

    // --- Sprint 2 Tasks (Completed deliverables under Client Approval - 10 total points) ---
    const [t3] = await db.insert(tasks).values({
        projectId: project.id,
        milestoneId: m2.id,
        title: "Develop Real-Time Appointment Scheduling Engine with Conflict Matrix",
        description: "Implement slot reservation logic with transactional PostgreSQL row locks to prevent simultaneous double-booking of doctor consultations.",
        weight: 5,
        status: "Done",
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        requiresProof: true,
        proofLinks: [{ label: "GitHub PR #5 (Scheduling Engine)", url: "https://github.com/optrizo/nexora-health/pull/5" }],
        proofNotes: "Engine stress-tested with 100 simulated concurrent booking requests. Zero race conditions or double bookings detected.",
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }).returning();

    const [t4] = await db.insert(tasks).values({
        projectId: project.id,
        milestoneId: m2.id,
        title: "Build Role-Segregated Client Portal & Deliverable Approval Flow",
        description: "Create role-segregated portal views for external clients with proposal execution, document exchange, and interactive milestone sign-offs.",
        weight: 3,
        status: "Done",
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        requiresProof: true,
        proofLinks: [{ label: "GitHub PR #8 (Client Portal)", url: "https://github.com/optrizo/nexora-health/pull/8" }],
        proofNotes: "Implemented authenticated deliverable proxy, threaded revision replies, and proposal digital signature capture.",
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    }).returning();

    const [t5] = await db.insert(tasks).values({
        projectId: project.id,
        milestoneId: m2.id,
        title: "Integrate Automated Definition of Done Gatekeeper Verification",
        description: "Connect Gemini AI link relevance analyzer with hard-fail caps for non-work URLs to validate deliverable authenticity.",
        weight: 2,
        status: "Done",
        requiresProof: true,
        proofLinks: [{ label: "GitHub PR #9 (DoD Engine)", url: "https://github.com/optrizo/nexora-health/pull/9" }],
        proofNotes: "Automated test suite passing. Gatekeeper rejects invalid URLs and computes confidence scores accurately.",
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    }).returning();

    // --- Sprint 3 Tasks (In Progress & Upcoming - 8 total points) ---
    const [t6] = await db.insert(tasks).values({
        projectId: project.id,
        milestoneId: m3.id,
        title: "End-to-End Penetration Testing, OWASP Top 10 & TLS Audit",
        description: "Conduct comprehensive security audit verifying NextAuth session middleware, parameterized queries, and PII encryption at rest.",
        weight: 3,
        status: "In Progress",
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        requiresProof: true
    }).returning();

    const [t7] = await db.insert(tasks).values({
        projectId: project.id,
        milestoneId: m3.id,
        title: "Automated Email & SMS Patient Dispatch Pipeline",
        description: "Deploy event-driven notification dispatch via Twilio and SendGrid for appointment confirmations, intake reminders, and telemedicine links.",
        weight: 2,
        status: "Todo",
        dependsOnTaskId: t3.id,
        dueDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
        requiresProof: true
    }).returning();

    const [t8] = await db.insert(tasks).values({
        projectId: project.id,
        milestoneId: m3.id,
        title: "Production Vercel Cloud Deployment, SSL Verification & DNS Cutover",
        description: "Deploy production build to Vercel Cloud Platform, configure custom domain SSL certificates, and deliver administrative handover documentation.",
        weight: 3,
        status: "Todo",
        dependsOnTaskId: t6.id,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        requiresProof: true
    }).returning();

    // 5.5 Assign Staff / Super Admin to Active Tasks
    await db.insert(taskAssignees).values([
        { taskId: t1.id, userId: admin.id },
        { taskId: t2.id, userId: admin.id },
        { taskId: t3.id, userId: admin.id },
        { taskId: t4.id, userId: admin.id },
        { taskId: t5.id, userId: admin.id },
        { taskId: t6.id, userId: admin.id },
        { taskId: t7.id, userId: admin.id },
        { taskId: t8.id, userId: admin.id }
    ]);

    // 5.6 Automated Definition of Done (DoD) Quality Gate Submissions
    
    // Submission 1: Task 4 (Client Portal PR #8) - 96% Confidence Passed
    await db.insert(taskSubmissions).values({
        taskId: t4.id,
        submittedBy: admin.id,
        proofUrl: "https://github.com/optrizo/nexora-health/pull/8",
        submissionNotes: "Implemented authenticated deliverable proxy, threaded revision replies, and proposal signature capture. Full unit and integration tests passing.",
        aiConfidenceScore: 96,
        gateStatus: "Passed",
        aiSummary: "Automated Quality Gate passed with 96% confidence. Deliverable is an authoritative GitHub pull request with 14 passing automated tests, clear git diff matching acceptance criteria, and zero merge conflicts.",
        criteriaBreakdown: [
            { criterion: "Deliverable Artifact Credibility & Relevance", status: "PASS", notes: "Authoritative code repository pull request verified on optrizo/nexora-health." },
            { criterion: "Proof URL Reachability & Access", status: "PASS", notes: "Valid PR link accessible and formatted correctly." },
            { criterion: "Acceptance Criteria Alignment", status: "PASS", notes: "Code diffs implement Client Portal review modals and digital signature capture." },
            { criterion: "Test Suite Execution Integrity", status: "PASS", notes: "24/24 unit and integration test assertions passed without regression." }
        ]
    });

    // Submission 2: Task 3 (Scheduling Engine PR #5) - 94% Confidence Passed
    await db.insert(taskSubmissions).values({
        taskId: t3.id,
        submittedBy: admin.id,
        proofUrl: "https://github.com/optrizo/nexora-health/pull/5",
        submissionNotes: "Implemented appointment reservation engine with transactional PostgreSQL row locks to prevent simultaneous double-booking of doctor slots.",
        aiConfidenceScore: 94,
        gateStatus: "Passed",
        aiSummary: "Automated Quality Gate passed with 94% confidence. Pull request contains verified transactional query logic and load tests simulating 100 concurrent booking requests.",
        criteriaBreakdown: [
            { criterion: "Deliverable Artifact Credibility & Relevance", status: "PASS", notes: "GitHub PR containing schema migrations and appointment controller logic verified." },
            { criterion: "Proof URL Reachability & Access", status: "PASS", notes: "Authoritative repository link verified." },
            { criterion: "Concurrency Benchmark Validation", status: "PASS", notes: "Stress test scripts verified 0 duplicate slot reservations under load." }
        ]
    });
    console.log("   ✅ Created 2 DoD Quality Gate Submissions (96% & 94% Passed)");

    // 5.7 Threaded Client Feedback Conversation on Milestone 2
    const [parentFeedback] = await db.insert(clientFeedback).values({
        milestoneId: m2.id,
        clientId: client.id,
        status: "REVISION_REQUESTED",
        commentText: "The staging portal looks fantastic! We tested the appointment scheduling calendar on both mobile and desktop. Could we ensure automated SMS reminders trigger 24 hours prior to scheduled consultations?",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    }).returning();

    // Agency Staff Reply in the Thread
    await db.insert(clientFeedback).values({
        milestoneId: m2.id,
        clientId: admin.id,
        parentFeedbackId: parentFeedback.id,
        status: "APPROVED",
        commentText: "Thank you Elena! We have scoped the automated SMS dispatch into Sprint 3 Task #7 using Twilio Messaging API. The scheduling engine and portal deliverables are ready for your final sign-off.",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    });

    // Milestone 1 Historical Approved Feedback
    await db.insert(clientFeedback).values({
        milestoneId: m1.id,
        clientId: client.id,
        status: "APPROVED",
        commentText: "Sprint 1 high-fidelity wireframes and PostgreSQL 3NF schema approved with high praise from our executive committee. Design tokens match our clinical branding perfectly.",
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    });
    console.log("   💬 Seeded Threaded Client Feedback & Revision History");

    // ==========================================
    // 6. GOVERNANCE: AUDIT LOGS & NOTIFICATIONS
    // ==========================================
    console.log("🛡️ Seeding Audit Logs & Notifications...");

    await db.insert(auditLogs).values([
        {
            userId: admin.id,
            action: "LOGIN",
            entity: "user",
            details: "Optrizo Super Admin executed administrative login from IP 192.168.1.100",
            createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        },
        {
            userId: admin.id,
            action: "CREATE",
            entity: "lead",
            details: "Created and qualified enterprise sales lead for Nexora Health Technologies ($35,000)",
            createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
        },
        {
            userId: admin.id,
            action: "CREATE",
            entity: "proposal",
            details: "Generated Statement of Work proposal OPT-2026-1042 ($35,000) with 3 sprint milestones",
            createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
        },
        {
            userId: client.id,
            action: "UPDATE",
            entity: "proposal",
            details: "Proposal OPT-2026-1042 approved and digitally signed by Elena Rostova from IP 198.51.100.42",
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        },
        {
            userId: admin.id,
            action: "CREATE",
            entity: "agency_project",
            details: "Provisioned active Kanban project board: Nexora Health - Telemedicine & Client Portal Platform",
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        },
        {
            userId: admin.id,
            action: "CREATE",
            entity: "task_submission",
            details: "Automated DoD Quality Gate evaluated and passed PR #8 with 96% confidence score",
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
            userId: admin.id,
            action: "CREATE",
            entity: "proposal",
            details: "Dispatched Phase 2 Addendum Proposal OPT-2026-1088 ($18,500) to Elena Rostova",
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        }
    ]);

    // Client Notifications (Elena Rostova)
    await db.insert(notifications).values([
        {
            userId: client.id,
            message: "Action Required: Phase 2 Addendum Proposal OPT-2026-1088 is ready for your digital signature.",
            type: "proposal",
            read: false,
            link: `/proposal/${prop2.id}`,
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        },
        {
            userId: client.id,
            message: "Sprint 2: Core Engineering is ready for your review and formal milestone approval.",
            type: "milestone",
            read: false,
            link: "/portal",
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
            userId: client.id,
            message: "Optrizo Super Admin replied to your Sprint 2 feedback ticket regarding automated SMS dispatch.",
            type: "feedback",
            read: false,
            link: "/portal",
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
            userId: client.id,
            message: "Sprint 1: Architecture, 3NF Data Schema & UI/UX Design System has been marked as Completed.",
            type: "milestone",
            read: true,
            link: "/portal",
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
    ]);

    // Admin Notifications
    await db.insert(notifications).values([
        {
            userId: admin.id,
            message: "Client Elena Rostova submitted feedback on Milestone Sprint 2: Core Engineering.",
            type: "feedback",
            read: false,
            link: `/dashboard/pm/${project.id}`,
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        },
        {
            userId: admin.id,
            message: "Automated DoD Quality Gate PASSED for Task PR #8 with 96% AI confidence score.",
            type: "quality_gate",
            read: false,
            link: `/dashboard/pm/${project.id}`,
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
            userId: admin.id,
            message: "Contract Executed: Elena Rostova signed Proposal OPT-2026-1042 ($35,000).",
            type: "proposal",
            read: true,
            link: "/dashboard/proposals",
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
    ]);

    // ==========================================
    // 7. VERIFICATION CHECK & PROGRESS DYNAMICS
    // ==========================================
    const [finalProject] = await db.select().from(agencyProjects).where(eq(agencyProjects.id, project.id));
    const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, project.id));
    const projectMilestones = await db.select().from(milestones).where(eq(milestones.projectId, project.id));
    const completedTasks = projectTasks.filter(t => t.status === "Done");
    const totalPoints = projectTasks.reduce((sum, t) => sum + (t.weight || 1), 0);
    const completedPoints = completedTasks.reduce((sum, t) => sum + (t.weight || 1), 0);

    console.log("\n=======================================================");
    console.log("🎉 RICH DEMO SEED VERIFICATION COMPLETE:");
    console.log(`   • Project: "${finalProject.title}"`);
    console.log(`   • DB Trigger Progress: ${finalProject.progressPercentage}%`);
    console.log(`   • Weighted Velocity: ${completedPoints} / ${totalPoints} Story Points (${Math.round((completedPoints / totalPoints) * 100)}%)`);
    console.log(`   • Milestones Created: ${projectMilestones.length}`);
    console.log(`   • Tasks Created: ${projectTasks.length} (${completedTasks.length} Done)`);
    console.log(`   • Staging URLs: ${finalProject.stagingUrls?.length || 0} active links`);
    console.log(`   • Documents Hub: ${finalProject.documents?.length || 0} files (Agency deliverables & Client uploads)`);
    console.log(`   • Pending Proposal: OPT-2026-1088 ready for digital signature`);
    console.log(`   • Signed Proposal: OPT-2026-1042 ($35,000)`);
    console.log(`   • Client Access: client@optrizo.com (Password: Password123!)`);
    console.log(`   • Admin Access: admin@optrizo.com (Password: Password123!)`);
    console.log("=======================================================\n");
}

// Execute if run directly
if (require.main === module) {
    seedDemoAccounts()
        .then(() => {
            console.log("✨ Seed script completed successfully!");
            process.exit(0);
        })
        .catch((e) => {
            console.error("❌ Seeding failed:", e);
            process.exit(1);
        });
}
