import { notFound, redirect } from "next/navigation";
import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { proposals, leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ProposalBuilderStudio } from "@/features/proposals/components/ProposalBuilderStudio";

export const metadata = {
    title: "Proposal Studio | Optrizo",
    description: "Author and customize client project proposals with live preview.",
};

export const dynamic = 'force-dynamic';

export default async function ProposalBuilderPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    if (!hasRole(session, ["superadmin", "sales", "manager", "developer", "content_editor"])) {
        redirect("/dashboard");
    }

    // 1. Try finding proposal directly by proposal ID
    let proposal = await db.query.proposals.findFirst({
        where: eq(proposals.id, id),
        with: {
            lead: {
                with: {
                    client: true,
                },
            },
        },
    });

    // 2. If not found by proposal ID, check if ID matches a leadId with an existing proposal
    if (!proposal) {
        proposal = await db.query.proposals.findFirst({
            where: eq(proposals.leadId, id),
            with: {
                lead: {
                    with: {
                        client: true,
                    },
                },
            },
            orderBy: (p, { desc }) => [desc(p.createdAt)],
        });
    }

    // 3. If still no proposal, check if ID matches an existing Lead. If so, auto-generate a starter Draft proposal
    if (!proposal) {
        const lead = await db.query.leads.findFirst({
            where: eq(leads.id, id),
            with: {
                client: true,
            },
        });

        if (lead) {
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

            // Redirect to the newly created proposal's dedicated studio URL
            redirect(`/dashboard/proposals/builder/${created.id}`);
        }
    }

    if (!proposal) {
        notFound();
    }

    return <ProposalBuilderStudio proposal={proposal as any} />;
}
