import type React from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Star } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agencyProjects, projectFeedback } from "@/db/schema";
import { auth, hasRole } from "@/auth";
import { authorizeProject } from "@/lib/authz";
import { ProjectHeader } from "@/features/pm/components/ProjectHeader";
import { ProjectResourcesSidebar } from "@/features/pm/components/ProjectResourcesSidebar";
import { ProjectSettingsModal } from "@/features/pm/components/ProjectSettingsModal";

/**
 * One header for every project view. Next keeps a layout on screen when moving between its pages,
 * so Board / Timeline / Activity switch like tabs: only the content below the header reloads.
 */
export default async function ProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");
    const { id } = await params;
    const access = await authorizeProject(id, "read");
    if (!access.ok) notFound();

    const project = await db.query.agencyProjects.findFirst({
        where: eq(agencyProjects.id, id),
        with: { stakeholders: { with: { user: true } }, lead: true },
    });
    if (!project) notFound();

    const isManager = hasRole(session, ["manager"]);
    // Managers see the client's feedback on every project view; the full answers are on the Feedback tab.
    const feedback = isManager
        ? await db.query.projectFeedback.findFirst({
              where: eq(projectFeedback.projectId, id),
              columns: { rating: true, wouldRecommend: true, reviewedAt: true },
          })
        : null;
    const client = project.stakeholders?.find((s) => s.user?.role === "client")?.user;

    return (
        <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col space-y-4 pb-12">
            <ProjectHeader
                projectId={project.id}
                title={project.title}
                businessName={client?.companyName || project.lead?.businessName}
                clientName={client?.name || project.lead?.contactName}
                isManager={isManager}
                extraTools={
                    isManager ? (
                        <>
                            <ProjectResourcesSidebar project={project as React.ComponentProps<typeof ProjectResourcesSidebar>["project"]} />
                            <ProjectSettingsModal project={project as unknown as React.ComponentProps<typeof ProjectSettingsModal>["project"]} />
                        </>
                    ) : null
                }
            />
            {feedback && (
                <Link
                    href={`/dashboard/pm/${project.id}/feedback`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm hover:bg-muted/40"
                >
                    <span className="font-semibold text-foreground">Client feedback</span>
                    <span className="flex items-center gap-1" aria-label={`Rating ${feedback.rating} out of 5`}>
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                        <span className="tabular-nums">{feedback.rating} / 5</span>
                    </span>
                    {feedback.wouldRecommend && (
                        <span className="text-muted-foreground">Would recommend: <span className="text-foreground">{feedback.wouldRecommend === "yes" ? "Yes" : feedback.wouldRecommend === "no" ? "No" : "Maybe"}</span></span>
                    )}
                    {!feedback.reviewedAt && <span className="rounded-full bg-stage-negotiation/15 px-2 py-0.5 text-xs font-semibold text-stage-negotiation">Not reviewed</span>}
                    <span className="ml-auto text-primary">View answers</span>
                </Link>
            )}
            {children}
        </div>
    );
}
