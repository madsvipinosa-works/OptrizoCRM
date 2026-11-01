import { db } from "@/db";
import { auth, hasRole } from "@/auth";
import { projectStakeholders, leads, notifications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ClientPortalDashboardView } from "@/features/client-portal/components/ClientPortalDashboardView";

export const dynamic = 'force-dynamic';

export default async function ClientPortalPage() {
    const session = await auth();
    // Redirect unauthenticated clients to customized login
    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/portal");
    }

    if (!hasRole(session, ["client"])) {
        redirect("/login?callbackUrl=/portal");
    }

    // Fetch the client's projects via the projectStakeholders junction
    const userStakeholderRecords = await db.query.projectStakeholders.findMany({
        where: eq(projectStakeholders.userId, session.user.id),
        with: {
            project: {
                with: {
                    milestones: {
                        orderBy: (milestones, { asc }) => [asc(milestones.order)],
                        with: {
                            feedback: {
                                orderBy: (clientFeedback, { desc }) => [desc(clientFeedback.createdAt)]
                            }
                        }
                    },
                    tasks: {
                        where: (tasks, { isNull }) => isNull(tasks.deletedAt),
                    },
                    lead: true
                }
            }
        }
    });

    const rawProjects = userStakeholderRecords
        .map(record => record.project)
        .filter((project): project is NonNullable<typeof project> => project !== null && !project.isArchived);

    rawProjects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // CRITICAL SECURITY FIX: Strip sensitive CRM data (margins, internal notes) via DTO mapping
    const projects = rawProjects.map(project => ({
        id: project.id,
        title: project.title,
        description: project.description,
        status: project.status,
        progressPercentage: project.progressPercentage ?? 0,
        stagingUrls: project.stagingUrls,
        documents: project.documents,
        createdAt: project.createdAt,
        milestones: project.milestones.map(m => ({
            id: m.id,
            title: m.title,
            status: m.status,
            order: m.order,
            feedback: m.feedback.map(f => ({
                id: f.id,
                status: f.status,
                commentText: f.commentText,
                createdAt: f.createdAt
            }))
        })),
        tasks: project.tasks.map(t => ({
            id: t.id,
            milestoneId: t.milestoneId,
            title: t.title,
            description: t.description,
            status: t.status,
            weight: t.weight ?? 1,
            proofLinks: t.proofLinks,
            proofNotes: t.proofNotes
        })),
        lead: project.leadId ? { id: project.leadId } : null
    }));

    // Fetch pending proposals for this client
    const clientLeadsWithProposals = await db.query.leads.findMany({
        where: eq(leads.clientId, session.user.id),
        with: {
            proposals: {
                orderBy: (proposals, { desc }) => [desc(proposals.createdAt)],
            },
        },
    });

    const pendingProposals = clientLeadsWithProposals
        .flatMap((l) => l.proposals)
        .filter((p) => p.status === "Sent");

    // Fetch recent notifications for this client
    const recentNotifications = await db.query.notifications.findMany({
        where: eq(notifications.userId, session.user.id),
        orderBy: [desc(notifications.createdAt)],
        limit: 10,
    });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    Project Dashboard
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Track delivery progress, review deliverables & proof of work, and access staging environments.
                </p>
            </div>

            <ClientPortalDashboardView 
                projects={projects} 
                pendingProposals={pendingProposals} 
                recentNotifications={recentNotifications} 
            />
        </div>
    );
}
