import { db } from "@/db";
import { auth, hasRole } from "@/auth";
import { projectStakeholders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { ClientPortalDashboardView } from "@/features/client-portal/components/ClientPortalDashboardView";

export const dynamic = 'force-dynamic';

export default async function ClientPortalPage() {
    const session = await auth();
    // Allow logged in users. Admins/editors can view/preview client project progress.
    if (!session?.user?.id) notFound();

    if (!hasRole(session, ["client", "superadmin", "manager", "sales", "developer", "content_editor"])) {
        redirect("/api/auth/signin");
    }

    const isAdminOrStaff = hasRole(session, ["superadmin", "manager", "sales", "developer", "content_editor"]);

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
                    tasks: true,
                    lead: true
                }
            }
        }
    });

    let rawProjects = userStakeholderRecords
        .map(record => record.project)
        .filter((project): project is NonNullable<typeof project> => project !== null);

    // If Admin/Staff testing and no direct stakeholder project, show all active projects for preview
    if (rawProjects.length === 0 && isAdminOrStaff) {
        rawProjects = await db.query.agencyProjects.findMany({
            with: {
                milestones: {
                    orderBy: (milestones, { asc }) => [asc(milestones.order)],
                    with: {
                        feedback: {
                            orderBy: (clientFeedback, { desc }) => [desc(clientFeedback.createdAt)]
                        }
                    }
                },
                tasks: true,
                lead: true
            }
        });
    }

    rawProjects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // CRITICAL SECURITY FIX: Strip sensitive CRM data (margins, internal notes) via DTO mapping
    const projects = rawProjects.map(project => ({
        id: project.id,
        title: project.title,
        description: project.description,
        status: project.status,
        stagingUrls: project.stagingUrls,
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
            proofLinks: t.proofLinks,
            proofNotes: t.proofNotes
        })),
        lead: project.leadId ? { id: project.leadId } : null
    }));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Project Dashboard
                </h1>
                <p className="text-sm text-zinc-400 mt-1">
                    Track delivery progress, review deliverables & proof of work, and access staging environments.
                </p>
            </div>

            <ClientPortalDashboardView projects={projects} />
        </div>
    );
}
