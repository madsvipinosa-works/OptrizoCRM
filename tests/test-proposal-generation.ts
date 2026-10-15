import "dotenv/config";
import { db } from "@/db";
import { leads, proposals, users } from "@/db/schema";
import { eq } from "drizzle-orm";

async function runProposalTest() {
    console.log("🧪 Starting Automated Lead SOW Proposal Generation Test...");
    let testUserId: string | null = null;
    let testLeadId: string | null = null;
    let testProposalId: string | null = null;

    try {
        // 1. Provision a test client user
        const testEmail = `test-sow-${Date.now()}@example.com`;
        const [clientUser] = await db.insert(users).values({
            name: "Test SOW Client",
            email: testEmail,
            role: "client",
        }).returning();
        testUserId = clientUser.id;
        console.log(`✓ Provisioned test client user: ${clientUser.id}`);

        // 2. Provision a test lead
        const [lead] = await db.insert(leads).values({
            clientId: clientUser.id,
            businessName: "Acme Enterprise Solutions",
            estimatedValue: 12500,
            goals: "Develop multi-tenant B2B portal with real-time analytics",
            timelineExpectation: "6-8 Weeks",
            status: "Discovery & Qualifying",
        }).returning();
        testLeadId = lead.id;
        console.log(`✓ Provisioned test lead: ${lead.id}`);

        // 3. Simulate SOW Draft Generation Logic
        const proposalCode = `OPT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const estValue = Number(lead.estimatedValue) || 5000;

        const [created] = await db.insert(proposals).values({
            leadId: lead.id,
            proposalCode,
            scope: lead.goals || `Strategic agency implementation and digital transformation for ${lead.businessName || "Client"}.`,
            timeline: lead.timelineExpectation || "4-6 Weeks from project kickoff",
            technicalApproach: "Modern Next.js architecture, high-performance API endpoints, responsive UX/UI, and automated deployment infrastructure.",
            deliverables: [
                "Architecture & Discovery: Comprehensive specification and visual design system.",
                "Core System Implementation: Full-stack feature delivery and component implementation.",
                "Quality Assurance & Deployment: Rigorous testing, performance optimization, and production go-live.",
            ],
            pricingStructure: [
                { name: "Strategic Design & Discovery", description: "Design tokens, components, and user flows", quantity: 1, unitPrice: Math.round(estValue * 0.3), total: Math.round(estValue * 0.3) },
                { name: "Full-Stack Development & Integration", description: "Frontend, backend server actions, and database", quantity: 1, unitPrice: Math.round(estValue * 0.5), total: Math.round(estValue * 0.5) },
                { name: "Deployment, QA & Handover", description: "Infrastructure setup, SSL, and performance optimization", quantity: 1, unitPrice: Math.round(estValue * 0.2), total: Math.round(estValue * 0.2) },
            ],
            subtotal: estValue,
            total: estValue,
            terms: "Payment Milestone Schedule: 50% initial commitment upon agreement signing, 50% upon final acceptance and handover.",
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: "Draft",
        }).returning();
        testProposalId = created.id;

        console.log(`✓ SOW Draft Proposal generated: ${created.id} (${created.proposalCode})`);

        // 4. Verify relations and fields
        const fetchedProposal = await db.query.proposals.findFirst({
            where: eq(proposals.id, created.id),
            with: {
                lead: {
                    with: {
                        client: true,
                    },
                },
            },
        });

        if (!fetchedProposal) throw new Error("Proposal could not be retrieved from DB!");
        if (fetchedProposal.leadId !== lead.id) throw new Error("Proposal leadId mismatch!");
        if (fetchedProposal.total !== 12500) throw new Error("Proposal total mismatch!");
        if (!Array.isArray(fetchedProposal.deliverables) || fetchedProposal.deliverables.length !== 3) {
            throw new Error("Deliverables array invalid!");
        }
        if (!Array.isArray(fetchedProposal.pricingStructure) || fetchedProposal.pricingStructure.length !== 3) {
            throw new Error("Pricing structure invalid!");
        }

        console.log("✅ PASSED: SOW Draft Proposal successfully created, linked to lead, and verified!");

        // 5. Test fallback query (when navigating by leadId instead of proposalId)
        const proposalByLead = await db.query.proposals.findFirst({
            where: eq(proposals.leadId, lead.id),
            orderBy: (p, { desc }) => [desc(p.createdAt)],
            with: {
                lead: {
                    with: {
                        client: true,
                    },
                },
            },
        });

        if (!proposalByLead || proposalByLead.id !== created.id) {
            throw new Error("Lead fallback query failed to locate latest proposal!");
        }
        console.log("✅ PASSED: Lead fallback query successfully resolved to proposal without redirect!");

    } finally {
        // Clean up
        console.log("🧹 Cleaning up test data...");
        if (testProposalId) {
            await db.delete(proposals).where(eq(proposals.id, testProposalId));
        }
        if (testLeadId) {
            await db.delete(leads).where(eq(leads.id, testLeadId));
        }
        if (testUserId) {
            await db.delete(users).where(eq(users.id, testUserId));
        }
        console.log("✨ Cleanup complete.");
    }
}

runProposalTest().catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});
