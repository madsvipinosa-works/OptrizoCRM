import { db } from "@/db";
import { auth } from "@/auth";
import { projectStakeholders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ClientPortalDashboardView } from "@/features/client-portal/components/ClientPortalDashboardView";

export const dynamic = 'force-dynamic';

export default async function ClientPortalPage() {
    const session = await auth();
    // Allow logged in users. Admins/editors can view/preview client project progress.
    if (!session?.user?.id) notFound();

    const isAdminOrStaff = session.user.role === "admin" || session.user.role === "editor";

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

    let projects = userStakeholderRecords
        .map(record => record.project)
        .filter((project): project is NonNullable<typeof project> => project !== null)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // If Admin/Staff testing and no direct stakeholder project, show all active projects for preview
    if (projects.length === 0 && isAdminOrStaff) {
        const allProjects = await db.query.agencyProjects.findMany({
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
        projects = allProjects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-glow bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-400">
                    Project Dashboard
                </h1>
                <p className="text-lg text-muted-foreground mt-2">
                    Track delivery progress, review deliverables & proof of work, and access staging environments.
                </p>
            </div>

            <ClientPortalDashboardView projects={projects} />
        </div>
    );
}
