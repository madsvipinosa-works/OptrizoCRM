import type React from "react";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agencyProjects } from "@/db/schema";
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
            {children}
        </div>
    );
}
