"use server";

import { db } from "@/db";
import { agencyProjects, milestones, tasks, sprints, projectStakeholders, projectTeamMembers, taskAssignees, users, payments, type ProjectDocumentItem } from "@/db/schema";
import { auth, hasRole } from "@/auth";
import { eq, and, isNull, ne, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createSystemNotification } from "@/features/notifications/send";
import { logAction } from "@/features/audit/log";
import { authorizeProject, requireRole, requireRoles } from "@/lib/authz";
import { closeMilestoneAndAdvance } from "@/features/pm/milestone-flow";
import { applyEndedSprints } from "@/features/sprints/sprint-end";
import { deriveSprintStatus, todayInManila } from "@/features/sprints/sprint-status";
import { sendPaymentDueEmail } from "@/lib/notifications";
import { z } from "zod";

export type ActionState = {
    message?: string;
    success?: boolean;
    errors?: Record<string, string[]>;
    task?: Record<string, unknown>;
    milestone?: Record<string, unknown>;
};

// --- Project Actions ---
export async function updateProjectDetails(
    projectId: string,
    data: {
        title: string;
        description?: string;
        status: "Kickoff" | "In Progress" | "In Review" | "Completed";
        startDate?: Date | string | null;
        targetDate?: Date | string | null;
        clientUserId?: string | null;
    }
): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["manager"])) {
        return { success: false, message: "Unauthorized: Admins & Managers only." };
    }

    if (data.status === "Completed") {
        return { success: false, message: "Projects can only be marked Completed via the project completion flow." };
    }

    try {
        const currentProject = await db.query.agencyProjects.findFirst({
            where: eq(agencyProjects.id, projectId),
            columns: { id: true, status: true },
        });

        if (!currentProject) {
            return { success: false, message: "Project not found." };
        }

        if (currentProject.status === "Completed") {
            return { success: false, message: "Completed projects cannot be modified." };
        }

        await db.transaction(async (tx) => {
            // 1. Update agency project core fields
            const updatePayload: Record<string, unknown> = {
                title: data.title.trim(),
                description: data.description !== undefined ? data.description.trim() : null,
                status: data.status,
                startDate: data.startDate ? new Date(data.startDate) : null,
                targetDate: data.targetDate ? new Date(data.targetDate) : null,
                updatedAt: new Date(),
            };

            await tx.update(agencyProjects)
                .set(updatePayload)
                .where(eq(agencyProjects.id, projectId));

            // 2. Role-Scoped Stakeholder Synchronization (Safeguard 1)
            // When updating clientUserId, only modify/remove client role stakeholders, never staff/managers/developers
            if (data.clientUserId !== undefined) {
                const existingStakeholders = await tx.query.projectStakeholders.findMany({
                    where: eq(projectStakeholders.projectId, projectId),
                    with: { user: true },
                });

                const existingClientStakeholder = existingStakeholders.find(s => s.user?.role === "client");

                if (data.clientUserId) {
                    if (!existingClientStakeholder || existingClientStakeholder.userId !== data.clientUserId) {
                        // Remove previous client junction if different
                        if (existingClientStakeholder) {
                            await tx.delete(projectStakeholders).where(
                                and(
                                    eq(projectStakeholders.projectId, projectId),
                                    eq(projectStakeholders.userId, existingClientStakeholder.userId)
                                )
                            );
                        }

                        // Add new client stakeholder if not already linked
                        const alreadyLinked = existingStakeholders.some(s => s.userId === data.clientUserId);
                        if (!alreadyLinked) {
                            await tx.insert(projectStakeholders).values({
                                projectId,
                                userId: data.clientUserId,
                            }).onConflictDoNothing();
                        }
                    }
                } else if (existingClientStakeholder) {
                    // Unassigned client: remove the client stakeholder
                    await tx.delete(projectStakeholders).where(
                        and(
                            eq(projectStakeholders.projectId, projectId),
                            eq(projectStakeholders.userId, existingClientStakeholder.userId)
                        )
                    );
                }
            }
        });

        await logAction(
            "UPDATE",
            "Project Details",
            `Project ${projectId} details updated`,
            session?.user?.id,
            currentProject.id ?? projectId
        );

        revalidatePath(`/dashboard/pm/${projectId}`);
        revalidatePath("/dashboard/pm");
        revalidatePath("/portal");

        return { success: true, message: "Project settings saved successfully." };
    } catch (error) {
        console.error("Failed to update project details:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function updateProjectStatus(projectId: string, status: "Kickoff" | "In Progress" | "In Review" | "Completed"): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    if (status === "Completed") {
        return { success: false, message: "Projects can only be marked Completed via the project completion flow." };
    }

    try {
        const oldProject = await db.query.agencyProjects.findFirst({ where: eq(agencyProjects.id, projectId) });
        if (!oldProject) {
            return { success: false, message: "Project not found" };
        }

        if (oldProject.status === "Completed") {
            return { success: false, message: "Completed projects cannot be reopened." };
        }

        await db.update(agencyProjects)
            .set({ status, updatedAt: new Date() })
            .where(eq(agencyProjects.id, projectId));

        await logAction(
            "UPDATE",
            "Project",
            `Project ${projectId} status updated to ${status}`,
            session?.user?.id,
            oldProject.id ?? projectId
        );

        const { notifyProjectClients } = await import("@/features/notifications/send");
        await notifyProjectClients(
            projectId,
            `Your project "${oldProject?.title || "Your project"}" moved to "${status}". Open the project to see the latest progress.`,
            "project",
            `/portal/projects/${projectId}`
        );

        revalidatePath("/dashboard/pm");
        revalidatePath("/portal");
        return { success: true, message: "Project status updated." };
    } catch (error) {
        console.error("Failed to update project status:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function updateProjectSettings(
    projectId: string, 
    stagingUrls: string[],
    documents?: ProjectDocumentItem[] // Note: Deprecated for full array replacement. Use addProjectDocument/deleteProjectDocument.
): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const updatePayload: Record<string, unknown> = {
            stagingUrls,
            updatedAt: new Date()
        };

        if (documents !== undefined) {
            updatePayload.documents = documents;
        }

        const [updatedProject] = await db
            .update(agencyProjects)
            .set(updatePayload)
            .where(eq(agencyProjects.id, projectId))
            .returning({ id: agencyProjects.id, title: agencyProjects.title });

        await logAction(
            "UPDATE",
            "Project Resources",
            `Project ${projectId} resources updated`,
            session?.user?.id,
            updatedProject?.id ?? projectId
        );

        if (stagingUrls && stagingUrls.length > 0) {
            const { notifyProjectClients } = await import("@/features/notifications/send");
            await notifyProjectClients(
                projectId,
                `New preview links are available for your project "${updatedProject?.title || "your project"}". Open the project to view them.`,
                "project",
                `/portal/projects/${projectId}`
            );
        }

        revalidatePath("/dashboard/pm/[id]");
        revalidatePath("/portal");
        return { success: true, message: "Project resources updated." };
    } catch (error) {
        console.error("Failed to update project settings:", error);
        return { success: false, message: "Database Error" };
    }
}

const ProjectDocumentInputSchema = z.object({
    id: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1).max(200),
    url: z.string().trim().min(1).max(2048).refine(
        (url) => url.startsWith("https://") || url.startsWith("/uploads/") || url.startsWith("/api/private-file?"),
        "Invalid file reference"
    ),
    type: z.enum(["pdf", "doc", "figma", "sheet", "link", "zip", "image"]),
    sizeBytes: z.number().int().min(0).optional(),
});

export async function addProjectDocument(projectId: string, newDoc: ProjectDocumentItem): Promise<ActionState> {
    const access = await authorizeProject(projectId, "write");
    if (!access.ok) {
        return { success: false, message: "Unauthorized" };
    }
    const { session } = access;

    const parsedDoc = ProjectDocumentInputSchema.safeParse(newDoc);
    if (!parsedDoc.success) {
        return { success: false, message: "Invalid document details." };
    }

    // Who uploaded it comes from the session, never from the caller.
    const uploadedByRole: "client" | "agency" = session.user.role === "client" ? "client" : "agency";
    const doc: ProjectDocumentItem = {
        ...parsedDoc.data,
        uploadedById: session.user.id,
        uploadedByName: session.user.name || (uploadedByRole === "client" ? "Client" : "Agency PM"),
        uploadedByRole,
        createdAt: new Date().toISOString(),
    };

    try {
        const { sql } = await import("drizzle-orm");
        const [updatedProject] = await db.update(agencyProjects)
            .set({
                documents: sql`COALESCE(${agencyProjects.documents}, '[]'::jsonb) || ${JSON.stringify([doc])}::jsonb`,
                updatedAt: new Date()
            })
            .where(eq(agencyProjects.id, projectId))
            .returning({ id: agencyProjects.id, title: agencyProjects.title });

        await logAction(
            "CREATE",
            "Project Document",
            `Added document '${doc.title}' to Project ${projectId}`,
            session.user.id,
            updatedProject?.id ?? projectId
        );

        if (doc.uploadedByRole === "agency") {
            const { notifyProjectClients } = await import("@/features/notifications/send");
            await notifyProjectClients(
                projectId,
                `The team uploaded "${doc.title}" to your project "${updatedProject?.title || "your project"}". Open the project to view it.`,
                "document",
                `/portal/projects/${projectId}`
            );
        } else {
            const { notifyAllAdmins } = await import("@/features/notifications/send");
            await notifyAllAdmins(
                `The client uploaded "${doc.title}" to the project "${updatedProject?.title || "your project"}". Open the project to view it.`,
                "document",
                `/dashboard/pm/${projectId}`
            );
        }

        revalidatePath(`/dashboard/pm/${projectId}`);
        revalidatePath("/dashboard/pm");
        revalidatePath("/portal");

        return { success: true, message: "Document added successfully." };
    } catch (error) {
        console.error("Failed to add project document:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function deleteProjectDocument(projectId: string, documentId: string): Promise<ActionState> {
    const access = await authorizeProject(projectId, "write");
    if (!access.ok) {
        return { success: false, message: "Unauthorized" };
    }
    const { session } = access;

    try {
        const project = await db.query.agencyProjects.findFirst({
            where: eq(agencyProjects.id, projectId)
        });
        
        if (!project || !project.documents) {
            return { success: false, message: "Project or documents not found" };
        }

        const docToDelete = project.documents.find(d => d.id === documentId);
        if (!docToDelete) {
            return { success: false, message: "Document not found" };
        }

        // RBAC: clients can only delete their own uploads; managers/admins can delete any document
        const isClient = session.user.role === "client";
        if (isClient && docToDelete.uploadedById !== session.user.id) {
            return { success: false, message: "Unauthorized: You can only delete your own uploads" };
        }
        
        // Atomically remove the item from JSONB
        const { sql } = await import("drizzle-orm");
        await db.update(agencyProjects).set({
            documents: sql`COALESCE((SELECT jsonb_agg(elem) FROM jsonb_array_elements(${agencyProjects.documents}) elem WHERE elem->>'id' != ${documentId}), '[]'::jsonb)`,
            updatedAt: new Date()
        }).where(eq(agencyProjects.id, projectId));

        const { deleteImage } = await import("@/features/upload/actions");
        if (docToDelete.url) {
            await deleteImage(docToDelete.url);
        }

        await logAction(
            "DELETE",
            "Project Document",
            `Deleted document '${docToDelete.title}' from Project ${projectId}`,
            session.user.id,
            project.id
        );

        revalidatePath(`/dashboard/pm/${projectId}`);
        revalidatePath("/dashboard/pm");
        revalidatePath("/portal");

        return { success: true, message: "Document deleted successfully." };
    } catch (error) {
        console.error("Failed to delete project document:", error);
        return { success: false, message: "Database Error" };
    }
}




// --- Milestone Actions ---
// --- Task Actions ---
export async function createTask(
    projectId: string, 
    milestoneId: string, 
    title: string, 
    description?: string, 
    assigneeIds?: string[],
    weight: number = 1,
    estimatedHours?: number,
    opts?: { sprintId?: string | null; toBacklog?: boolean }
): Promise<ActionState> {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized" };
    }

    const access = await authorizeProject(projectId, "write");
    if (!access.ok) {
        return { success: false, message: "Unauthorized" };
    }

    if (!title.trim()) return { success: false, message: "Title is required" };

    try {
        await applyEndedSprints(projectId);

        const milestone = await db.query.milestones.findFirst({
            where: and(eq(milestones.id, milestoneId), isNull(milestones.deletedAt)),
        });
        if (!milestone || (milestone.projectId && milestone.projectId !== projectId)) {
            return { success: false, message: "Milestone not found" };
        }
        if (milestone.status === "Completed") {
            return { success: false, message: "Cannot add task to a completed milestone" };
        }

        const cleanAssigneeIds = Array.from(new Set((assigneeIds || []).filter(Boolean)));
        if (cleanAssigneeIds.length > 0) {
            for (const uid of cleanAssigneeIds) {
                const isMember = await db.query.projectTeamMembers.findFirst({
                    where: and(eq(projectTeamMembers.projectId, projectId), eq(projectTeamMembers.userId, uid)),
                });
                if (!isMember) {
                    return { success: false, message: "Assigned user is not a member of the project team" };
                }
            }
        }

        const isDevMilestone =
            milestone.name === "development" || milestone.title === "Full-Stack Development";

        let initialStatus: "backlog" | "to_do" = isDevMilestone ? "backlog" : "to_do";
        let resolvedSprintId: string | null = null;

        if (isDevMilestone && opts?.sprintId && !opts?.toBacklog) {
            const targetSprint = await db.query.sprints.findFirst({
                where: and(eq(sprints.id, opts.sprintId), eq(sprints.projectId, projectId)),
            });
            if (!targetSprint) {
                return { success: false, message: "Sprint not found in this project" };
            }
            if (deriveSprintStatus(targetSprint.startDate, targetSprint.endDate, todayInManila()) === "ended") {
                return { success: false, message: "Cannot add task to an ended sprint" };
            }
            initialStatus = "to_do";
            resolvedSprintId = targetSprint.id;
        }

        const [newTask] = await db.insert(tasks).values({
            projectId,
            milestoneId,
            sprintId: resolvedSprintId,
            title,
            description,
            status: initialStatus,
            weight: weight || 1,
            estimatedHours: estimatedHours || null
        }).returning();

        if (cleanAssigneeIds.length > 0) {
            const { taskAssignees } = await import("@/db/schema");
            await db.insert(taskAssignees).values(
                cleanAssigneeIds.map(userId => ({ taskId: newTask.id, userId }))
            );
        }

        await logAction("CREATE", "Task", `Task "${title}" created`, authz.session.user.id, newTask?.projectId ?? milestone.projectId ?? projectId);

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task created.", task: newTask };
    } catch (error) {
        console.error("Failed to create task:", error);
        return { success: false, message: "Database Error" };
    }
}

/**
 * submitTask (step 25 in docs/api-contract.md)
 * Who can call: developer (assigned task only)
 * Input: { taskId: string, files: string[], links: string[], note?: string }
 * Output: { ok: true, status: 'in_review' }
 * Errors:
 * - NEED_FILE_OR_LINK: no file and no link.
 * - FORBIDDEN: caller is not the assigned developer.
 * - INVALID_STATUS: task is not in_progress or changes_requested.
 * Side effects: task -> in_review; PM notification; audit log row.
 */
export async function submitTask(input: {
    taskId: string;
    files: string[];
    links: string[];
    note?: string;
}): Promise<{ ok: true; status: "in_review" } | { ok: false; error: string }> {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "developer") {
        return { ok: false, error: "FORBIDDEN" };
    }

    const hasFiles = Array.isArray(input.files) && input.files.some((f) => f && f.trim().length > 0);
    const hasLinks = Array.isArray(input.links) && input.links.some((l) => l && l.trim().length > 0);
    if (!hasFiles && !hasLinks) {
        return { ok: false, error: "NEED_FILE_OR_LINK" };
    }

    const assignment = await db.query.taskAssignees.findFirst({
        where: and(eq(taskAssignees.taskId, input.taskId), eq(taskAssignees.userId, session.user.id)),
    });
    if (!assignment) {
        return { ok: false, error: "FORBIDDEN" };
    }

    const combinedProofLinks: { label: string; url: string }[] = [
        ...(input.links || []).filter((l) => l && l.trim().length > 0).map((url) => ({ label: "Link", url: url.trim() })),
        ...(input.files || []).filter((f) => f && f.trim().length > 0).map((fileUrl) => ({ label: "File", url: fileUrl.trim() })),
    ];

    let taskTitle = "";
    let taskProjectId: string | null = null;

    try {
        await db.transaction(async (tx) => {
            const [task] = await tx
                .select()
                .from(tasks)
                .where(and(eq(tasks.id, input.taskId), isNull(tasks.deletedAt)))
                .for("update");

            if (!task) {
                throw new Error("TASK_NOT_FOUND");
            }

            if (task.status !== "in_progress" && task.status !== "changes_requested") {
                throw new Error("INVALID_STATUS");
            }

            taskTitle = task.title;
            taskProjectId = task.projectId;

            await tx.update(tasks)
                .set({
                    status: "in_review",
                    proofLinks: combinedProofLinks,
                    proofNotes: input.note?.trim() || null,
                    reviewNote: null,
                    updatedAt: new Date(),
                })
                .where(eq(tasks.id, input.taskId));
        });
    } catch (err: unknown) {
        if (err instanceof Error && (err.message === "TASK_NOT_FOUND" || err.message === "INVALID_STATUS")) {
            return { ok: false, error: err.message };
        }
        console.error("submitTask error:", err);
        return { ok: false, error: "DATABASE_ERROR" };
    }

    const { notifyAllAdmins: notifyAdmins } = await import("@/features/notifications/send");
    await notifyAdmins(
        `Task "${taskTitle}" has been submitted for review by ${session.user.name || "assigned developer"}.`,
        "task",
        taskProjectId ? `/dashboard/pm/${taskProjectId}` : "/dashboard/pm"
    );

    await logAction(
        "UPDATE",
        "Task",
        `Developer ${session.user.name || session.user.id} submitted task "${taskTitle}" (${input.taskId}) for review`,
        session.user.id,
        taskProjectId ?? undefined
    );

    if (taskProjectId) {
        revalidatePath(`/dashboard/pm/${taskProjectId}`);
    }
    revalidatePath("/dashboard/pm/[id]", "page");
    revalidatePath("/dashboard/my-tasks");
    revalidatePath("/portal");

    return { ok: true, status: "in_review" };
}

export async function updateTaskDetails(
    taskId: string,
    data: {
        title?: string;
        description?: string;
        assigneeIds?: string[];
        dueDate?: Date | null;
        weight?: number;
        estimatedHours?: number | null;
        dependsOnTaskId?: string | null;
    }
): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["manager"])) {
        return { success: false, message: "Unauthorized: Only managers can update task details" };
    }

    try {
        const existingTask = await db.query.tasks.findFirst({
            where: eq(tasks.id, taskId),
            columns: { projectId: true },
        });
        if (!existingTask) return { success: false, message: "Task not found" };

        const cleanAssigneeIds = data.assigneeIds !== undefined
            ? Array.from(new Set((data.assigneeIds || []).filter(Boolean)))
            : undefined;

        if (cleanAssigneeIds && cleanAssigneeIds.length > 0) {
            for (const uid of cleanAssigneeIds) {
                const isMember = await db.query.projectTeamMembers.findFirst({
                    where: and(eq(projectTeamMembers.projectId, existingTask.projectId), eq(projectTeamMembers.userId, uid)),
                });
                if (!isMember) {
                    return { success: false, message: "Assigned user is not a member of the project team" };
                }
            }
        }

        const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
        };
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
        if (data.weight !== undefined) updateData.weight = data.weight;
        if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
        if (data.dependsOnTaskId !== undefined) {
            if (data.dependsOnTaskId === taskId) {
                return { success: false, message: "A task cannot depend on itself." };
            }
            if (data.dependsOnTaskId) {
                const candidate = await db.query.tasks.findFirst({
                    where: and(eq(tasks.id, data.dependsOnTaskId), eq(tasks.projectId, existingTask.projectId)),
                    columns: { id: true, dependsOnTaskId: true, title: true },
                });
                if (!candidate) {
                    return { success: false, message: "Prerequisite task not found in this project." };
                }
                if (candidate.dependsOnTaskId === taskId) {
                    return { success: false, message: `Circular dependency: "${candidate.title}" already depends on this task.` };
                }
            }
            updateData.dependsOnTaskId = data.dependsOnTaskId;
        }

        const [updatedTask] = await db.update(tasks)
            .set(updateData)
            .where(eq(tasks.id, taskId))
            .returning();

        if (cleanAssigneeIds !== undefined) {
             const { taskAssignees } = await import("@/db/schema");
             await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
             if (cleanAssigneeIds.length > 0) {
                 await db.insert(taskAssignees).values(
                     cleanAssigneeIds.map(userId => ({ taskId, userId }))
                 );
             }
        }

        await logAction(
            "UPDATE",
            "Task",
            `Task ${taskId} details updated`,
            session?.user?.id,
            existingTask.projectId
        );

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task details updated.", task: updatedTask };
    } catch (error) {
        console.error("Failed to update task details:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function deleteTask(taskId: string): Promise<ActionState> {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const taskRow = await db.query.tasks.findFirst({
            where: and(eq(tasks.id, taskId), isNull(tasks.deletedAt)),
            columns: {
                id: true,
                projectId: true,
                status: true,
                title: true,
            },
        });

        if (!taskRow) {
            return { success: false, message: "Task not found" };
        }

        const projectId = taskRow.projectId;
        const access = await authorizeProject(projectId, "write");
        if (!access.ok) {
            return { success: false, message: "Unauthorized" };
        }

        if (taskRow.status !== "backlog" && taskRow.status !== "to_do") {
            return {
                success: false,
                message: "Only tasks that have not started can be deleted.",
            };
        }

        await db.update(tasks)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(tasks.id, taskId));

        await logAction(
            "DELETE",
            "Task",
            `Task ${taskId} soft-deleted`,
            authz.session.user.id,
            projectId
        );

        revalidatePath(`/dashboard/pm/${projectId}`);
        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task deleted." };
    } catch (error) {
        console.error("Failed to delete task:", error);
        return { success: false, message: "Database Error" };
    }
}

// --- Deadline Tracking ---
export async function checkAndNotifyOverdueTasks(): Promise<{ success: boolean; found: number }> {
    const session = await auth();
    if (!hasRole(session, ["manager"])) {
        return { success: false, found: 0 };
    }

    try {
        const { lte, ne, isNotNull } = await import("drizzle-orm");
        
        // Find tasks that are:
        // 1. Not Done
        // 2. Have a due date
        // 3. Due date is in the past
        // 4. Have not been notified yet (overdueNotified === false)
        const overdueTasks = await db.query.tasks.findMany({
            where: and(
                ne(tasks.status, "done"),
                isNotNull(tasks.dueDate),
                lte(tasks.dueDate, new Date()),
                eq(tasks.overdueNotified, false)
            ),
            with: {
                milestone: {
                    with: {
                        project: true
                    }
                },
                assignees: {
                    with: { user: true }
                }
            }
        });

        if (overdueTasks.length === 0) {
            return { success: true, found: 0 };
        }

        const { notifyAllAdmins, createSystemNotification } = await import("@/features/notifications/send");
        let notifiedCount = 0;

        for (const task of overdueTasks) {
            const project = task.milestone?.project;
            if (!project) continue;

            // Notify Assignees if they exist
            const assignees = task.assignees || [];
            for (const assignee of assignees) {
                if (assignee.userId) {
                    await createSystemNotification(
                        assignee.userId, 
                        `OVERDUE: The task "${task.title}" is past its deadline.`, 
                        "alert", 
                        `/dashboard/pm/${project.id}`
                    );
                }
            }

            // Also notify Admins
            await notifyAllAdmins(
                `Overdue Task: The task "${task.title}" in Project "${project.title}" is overdue.`,
                "alert",
                `/dashboard/pm/${project.id}`
            );

            // Mark as notified
            await db.update(tasks)
                .set({ overdueNotified: true })
                .where(eq(tasks.id, task.id));
                
            notifiedCount++;
        }

        return { success: true, found: notifiedCount };

    } catch (error) {
        console.error("Failed to check overdue tasks:", error);
        return { success: false, found: 0 };
    }
}

export async function archiveProject(projectId: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["manager"])) {
        return { success: false, message: "Unauthorized: Admins only." };
    }

    try {
        const [archivedProject] = await db.update(agencyProjects)
            .set({ isArchived: true, updatedAt: new Date() })
            .where(eq(agencyProjects.id, projectId))
            .returning({ id: agencyProjects.id });

        await logAction(
            "UPDATE",
            "Project",
            `Project ${projectId} archived.`,
            session?.user?.id,
            archivedProject?.id ?? projectId
        );

        revalidatePath("/dashboard/pm");
        revalidatePath("/portal");
        return { success: true, message: "Project securely archived." };
    } catch (error) {
        console.error("Failed to archive project:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function unarchiveProject(projectId: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["manager"])) {
        return { success: false, message: "Unauthorized: Admins only." };
    }

    try {
        const [unarchivedProject] = await db.update(agencyProjects)
            .set({ isArchived: false, updatedAt: new Date() })
            .where(eq(agencyProjects.id, projectId))
            .returning({ id: agencyProjects.id });

        await logAction(
            "UPDATE",
            "Project",
            `Project ${projectId} unarchived.`,
            session?.user?.id,
            unarchivedProject?.id ?? projectId
        );

        revalidatePath(`/dashboard/pm/${projectId}`);
        revalidatePath("/dashboard/pm");
        revalidatePath("/portal");
        return { success: true, message: "Project restored to active delivery board." };
    } catch (error) {
        console.error("Failed to unarchive project:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function getClientUsers(): Promise<{ id: string; name: string | null; email: string; image: string | null }[]> {
    // Client names and emails are only needed by the PM when assigning a client to a project.
    const access = await requireRoles(["manager"]);
    if (!access.ok) return [];
    return db.query.users.findMany({
        where: eq(users.role, "client"),
        columns: { id: true, name: true, email: true, image: true },
        orderBy: (u, { asc }) => [asc(u.name)],
    });
}


/**
 * Step 25: A developer starts a task from to_do -> in_progress.
 * Requires:
 * - Developer assigned to task (or manager)
 * - Task in status 'to_do'
 * - Parent milestone in status 'In Progress'
 * - Prerequisite task (dependsOnTaskId) is 'done'
 */
export async function startTask(
    taskId: string
): Promise<{ success: boolean; message?: string }> {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "developer") {
        return { success: false, message: "Unauthorized: Only assigned developers can start tasks" };
    }

    const assignment = await db.query.taskAssignees.findFirst({
        where: and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, session.user.id)),
    });
    if (!assignment) {
        return { success: false, message: "Unauthorized: Task not assigned to you" };
    }

    try {
        const preTask = await db.query.tasks.findFirst({
            where: and(eq(tasks.id, taskId), isNull(tasks.deletedAt)),
            columns: { projectId: true },
        });
        if (preTask?.projectId) {
            await applyEndedSprints(preTask.projectId);
        }

        const result = await db.transaction(async (tx) => {
            const [task] = await tx
                .select()
                .from(tasks)
                .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
                .for("update");

            if (!task) {
                return { success: false, message: "Task not found" };
            }

            if (task.status !== "to_do") {
                return { success: false, message: "Only tasks in To Do status can be started" };
            }

            if (task.milestoneId) {
                const [milestone] = await tx
                    .select()
                    .from(milestones)
                    .where(and(eq(milestones.id, task.milestoneId), isNull(milestones.deletedAt)));

                if (!milestone || milestone.status !== "In Progress") {
                    return { success: false, message: "Cannot start task: Milestone is not In Progress" };
                }
            }

            if (task.dependsOnTaskId) {
                const [prereq] = await tx
                    .select()
                    .from(tasks)
                    .where(and(eq(tasks.id, task.dependsOnTaskId), isNull(tasks.deletedAt)));

                if (!prereq || prereq.status !== "done") {
                    return {
                        success: false,
                        message: `Prerequisite task "${prereq?.title || "Prerequisite"}" must be completed first`,
                    };
                }
            }

            await tx
                .update(tasks)
                .set({
                    status: "in_progress",
                    updatedAt: new Date(),
                })
                .where(eq(tasks.id, taskId));

            return { success: true, task };
        });

        if (!result.success) {
            return { success: false, message: result.message };
        }

        try {
            await logAction("UPDATE", "Task", `Started task "${result.task?.title || taskId}"`, session.user.id, result.task?.projectId);
        } catch (logErr) {
            console.error("Post-commit log error in startTask:", logErr);
        }

        if (result.task?.projectId) {
            revalidatePath(`/dashboard/pm/${result.task.projectId}`);
        }
        revalidatePath("/dashboard/my-tasks");
        return { success: true };
    } catch (error: unknown) {
        console.error("startTask error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to start task",
        };
    }
}

export async function approveTask(
    taskId: string
): Promise<{ success: boolean; message?: string }> {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can approve tasks" };
    }

    try {
        const txResult = await db.transaction(async (tx) => {
            const [task] = await tx
                .select()
                .from(tasks)
                .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
                .for("update");

            if (!task) {
                return { success: false, message: "Task not found" };
            }

            if (task.status !== "in_review") {
                return { success: false, message: "Task must be in review to be approved" };
            }

            await tx
                .update(tasks)
                .set({
                    status: "done",
                    completedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(tasks.id, taskId));

            let closeResult = null;
            if (task.milestoneId) {
                const remainingTasks = await tx
                    .select({ id: tasks.id, status: tasks.status })
                    .from(tasks)
                    .where(and(
                        eq(tasks.milestoneId, task.milestoneId),
                        isNull(tasks.deletedAt),
                        ne(tasks.id, taskId)
                    ));

                const allOthersDone = remainingTasks.every((t) => t.status === "done");
                if (allOthersDone) {
                    closeResult = await closeMilestoneAndAdvance(tx, task.milestoneId);
                }
            }

            const assignees = await tx
                .select({ userId: taskAssignees.userId })
                .from(taskAssignees)
                .where(eq(taskAssignees.taskId, taskId));

            return {
                success: true,
                task,
                assignees: assignees.map((a) => a.userId),
                closeResult,
            };
        });

        if (!txResult.success || !txResult.task) {
            return { success: false, message: txResult.message || "Failed to approve task" };
        }

        const { task, assignees, closeResult } = txResult;

        try {
            for (const uid of assignees || []) {
                await createSystemNotification(
                    uid,
                    `Your task "${task?.title}" has been approved!`,
                    "task",
                    task?.projectId ? `/dashboard/pm/${task.projectId}` : "/dashboard/my-tasks"
                );
            }

            if (closeResult?.nextMilestone && task?.projectId) {
                const { notifyAllAdmins: notifyAdmins } = await import("@/features/notifications/send");
                await notifyAdmins(
                    `Milestone "${closeResult.closedMilestone.title}" completed. Next milestone "${closeResult.nextMilestone.title}" is now In Progress.`,
                    "milestone",
                    `/dashboard/pm/${task.projectId}`
                );
            }

            if (closeResult && closeResult.duePaymentIds.length > 0 && task?.projectId) {
                const { notifyProjectClients } = await import("@/features/notifications/send");
                await notifyProjectClients(
                    task.projectId,
                    `Payment is now due for completed milestone "${closeResult.closedMilestone.title}".`,
                    "milestone",
                    `/portal/projects/${task.projectId}/payments`
                );

                const duePayments = await db.query.payments.findMany({
                    where: inArray(payments.id, closeResult.duePaymentIds),
                    with: {
                        project: {
                            with: {
                                lead: {
                                    with: { client: true },
                                },
                                stakeholders: {
                                    with: { user: true },
                                },
                            },
                        },
                    },
                });

                for (const dp of duePayments) {
                    const clientUser =
                        dp.project?.lead?.client ||
                        dp.project?.stakeholders?.find((s) => s.user?.role === "client")?.user;
                    const clientEmail = clientUser?.email || dp.project?.lead?.contactEmail;
                    if (clientEmail) {
                        await sendPaymentDueEmail({
                            clientEmail,
                            clientName: clientUser?.name || dp.project?.lead?.contactName || "Client",
                            projectTitle: dp.project?.title || "Your Project",
                            amount: dp.amount.toLocaleString(),
                            currency: dp.currency,
                            dueDate: dp.dueDate,
                            paymentsUrl: `${process.env.NEXTAUTH_URL || ""}/portal/projects/${dp.projectId}/payments`,
                        });
                    }
                }
            }

            await logAction(
                "UPDATE",
                "Task",
                `Approved task "${task?.title}" (${taskId}) to Done`,
                authz.session.user.id,
                task?.projectId
            );
            if (closeResult) {
                await logAction(
                    "UPDATE",
                    "Milestone",
                    `Milestone "${closeResult.closedMilestone.title}" completed automatically upon task completion`,
                    authz.session.user.id,
                    closeResult.closedMilestone.projectId ?? task?.projectId
                );
            }
        } catch (postCommitErr) {
            console.error("Post-commit error in approveTask:", postCommitErr);
        }

        if (task?.projectId) {
            revalidatePath(`/dashboard/pm/${task.projectId}`);
        }
        revalidatePath("/dashboard/my-tasks");
        return { success: true };
    } catch (error: unknown) {
        console.error("approveTask error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to approve task",
        };
    }
}

/**
 * Step 27: Manager requests changes on a task in review -> changes_requested.
 * Comment is stored in task.reviewNote and assignees are notified.
 */
export async function requestTaskChanges(
    taskId: string,
    comment: string
): Promise<{ success: boolean; message?: string }> {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can request changes" };
    }

    const trimmedComment = (comment || "").trim();
    if (!trimmedComment) {
        return { success: false, message: "A comment explaining requested changes is required" };
    }
    const safeComment = trimmedComment.slice(0, 2000);

    try {
        const txResult = await db.transaction(async (tx) => {
            const [task] = await tx
                .select()
                .from(tasks)
                .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
                .for("update");

            if (!task) {
                return { success: false, message: "Task not found" };
            }

            if (task.status !== "in_review") {
                return { success: false, message: "Task must be in review to request changes" };
            }

            await tx
                .update(tasks)
                .set({
                    status: "changes_requested",
                    reviewNote: safeComment,
                    updatedAt: new Date(),
                })
                .where(eq(tasks.id, taskId));

            const assignees = await tx
                .select({ userId: taskAssignees.userId })
                .from(taskAssignees)
                .where(eq(taskAssignees.taskId, taskId));

            return {
                success: true,
                task,
                assignees: assignees.map((a) => a.userId),
            };
        });

        if (!txResult.success || !txResult.task) {
            return { success: false, message: txResult.message || "Failed to request task changes" };
        }

        const { task, assignees } = txResult;

        try {
            for (const uid of assignees || []) {
                await createSystemNotification(
                    uid,
                    `Changes requested on "${task?.title}": ${safeComment}`,
                    "task",
                    task?.projectId ? `/dashboard/pm/${task.projectId}` : "/dashboard/my-tasks"
                );
            }
            await logAction(
                "UPDATE",
                "Task",
                `Requested changes on task "${task?.title}" (${taskId}): ${safeComment}`,
                authz.session.user.id,
                task?.projectId
            );
        } catch (postCommitErr) {
            console.error("Post-commit error in requestTaskChanges:", postCommitErr);
        }

        if (task?.projectId) {
            revalidatePath(`/dashboard/pm/${task.projectId}`);
        }
        revalidatePath("/dashboard/my-tasks");
        return { success: true };
    } catch (error: unknown) {
        console.error("requestTaskChanges error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to request task changes",
        };
    }
}

/**
 * Step 28: Manager completes a milestone that has no tasks (e.g. handover).
 * Requires non-empty reason, saved to milestone.doneReason.
 * Advances to next milestone via closeMilestoneAndAdvance in transaction.
 */
export async function markEmptyMilestoneDone(input: {
    milestoneId: string;
    reason: string;
}): Promise<{ success: boolean; message?: string }> {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can complete empty milestones" };
    }

    if (!input.milestoneId) {
        return { success: false, message: "Milestone ID is required" };
    }

    const trimmedReason = (input.reason || "").trim();
    if (!trimmedReason) {
        return { success: false, message: "Reason is required to mark an empty milestone as done" };
    }
    const safeReason = trimmedReason.slice(0, 2000);

    try {
        const txResult = await db.transaction(async (tx) => {
            const [milestone] = await tx
                .select()
                .from(milestones)
                .where(and(eq(milestones.id, input.milestoneId), isNull(milestones.deletedAt)))
                .for("update");

            if (!milestone) {
                return { success: false, message: "Milestone not found" };
            }

            if (milestone.status !== "In Progress") {
                return { success: false, message: "Only In Progress milestones can be completed" };
            }

            const existingTasks = await tx
                .select({ id: tasks.id })
                .from(tasks)
                .where(and(eq(tasks.milestoneId, input.milestoneId), isNull(tasks.deletedAt)));

            if (existingTasks.length > 0) {
                return { success: false, message: "Milestone has tasks and cannot be marked empty" };
            }

            const closeResult = await closeMilestoneAndAdvance(tx, input.milestoneId, {
                doneReason: safeReason,
            });

            return { success: true, milestone, closeResult };
        });

        if (!txResult.success || !txResult.milestone || !txResult.closeResult) {
            return { success: false, message: txResult.message || "Failed to mark empty milestone done" };
        }

        const { milestone, closeResult } = txResult;

        try {
            if (closeResult?.nextMilestone && milestone.projectId) {
                const { notifyAllAdmins: notifyAdmins } = await import("@/features/notifications/send");
                await notifyAdmins(
                    `Empty milestone "${milestone.title}" completed (${safeReason}). Next milestone "${closeResult.nextMilestone.title}" is now In Progress.`,
                    "milestone",
                    `/dashboard/pm/${milestone.projectId}`
                );
            }

            if (closeResult && closeResult.duePaymentIds.length > 0 && milestone.projectId) {
                const { notifyProjectClients } = await import("@/features/notifications/send");
                await notifyProjectClients(
                    milestone.projectId,
                    `Payment is now due for milestone "${milestone.title}".`,
                    "milestone",
                    `/portal/projects/${milestone.projectId}/payments`
                );

                const duePayments = await db.query.payments.findMany({
                    where: inArray(payments.id, closeResult.duePaymentIds),
                    with: {
                        project: {
                            with: {
                                lead: {
                                    with: { client: true },
                                },
                                stakeholders: {
                                    with: { user: true },
                                },
                            },
                        },
                    },
                });

                for (const dp of duePayments) {
                    const clientUser =
                        dp.project?.lead?.client ||
                        dp.project?.stakeholders?.find((s) => s.user?.role === "client")?.user;
                    const clientEmail = clientUser?.email || dp.project?.lead?.contactEmail;
                    if (clientEmail) {
                        await sendPaymentDueEmail({
                            clientEmail,
                            clientName: clientUser?.name || dp.project?.lead?.contactName || "Client",
                            projectTitle: dp.project?.title || "Your Project",
                            amount: dp.amount.toLocaleString(),
                            currency: dp.currency,
                            dueDate: dp.dueDate,
                            paymentsUrl: `${process.env.NEXTAUTH_URL || ""}/portal/projects/${dp.projectId}/payments`,
                        });
                    }
                }
            }

            await logAction(
                "UPDATE",
                "Milestone",
                `Manager marked empty milestone "${milestone.title}" as done (reason: ${safeReason})`,
                authz.session.user.id,
                milestone.projectId
            );
        } catch (postCommitErr) {
            console.error("Post-commit error in markEmptyMilestoneDone:", postCommitErr);
        }

        if (milestone.projectId) {
            revalidatePath(`/dashboard/pm/${milestone.projectId}`);
        }
        return { success: true };
    } catch (error: unknown) {
        console.error("markEmptyMilestoneDone error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to mark empty milestone done",
        };
    }
}
