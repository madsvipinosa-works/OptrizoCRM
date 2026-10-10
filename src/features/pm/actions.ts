"use server";

import { db } from "@/db";
import { agencyProjects, milestones, tasks, projectStakeholders, taskAssignees, users, type ProjectDocumentItem } from "@/db/schema";
import { auth, hasRole } from "@/auth";
import { eq, and, desc, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notifyAllAdmins } from "@/features/notifications/actions";
import { logAction } from "@/features/audit/actions";
import { logSystemError } from "@/features/audit/error-logger";

export type ActionState = {
    message?: string;
    success?: boolean;
    errors?: Record<string, string[]>;
    task?: Record<string, unknown>;
    milestone?: Record<string, unknown>;
};

// --- Helpers ---
async function handleMilestoneBubbling(tx: any, taskId: string, newTaskStatus: string, oldTask: any) {
    if (!oldTask.milestoneId) return null;
    
    const { isNull } = await import("drizzle-orm");
    const allTasks = await tx.query.tasks.findMany({
        where: and(eq(tasks.milestoneId, oldTask.milestoneId), isNull(tasks.deletedAt))
    });
    
    const currentTasksState = allTasks.map((t: any) => t.id === taskId ? { ...t, status: newTaskStatus } : t);

    const allDone = currentTasksState.length > 0 && currentTasksState.every((t: any) => t.status === "Done");
    const allReviewOrDone = currentTasksState.length > 0 && currentTasksState.every((t: any) => t.status === "In Review" || t.status === "Done");
    const anyActive = currentTasksState.some((t: any) => ["In Progress", "In Review", "Changes Requested"].includes(t.status));

    const currentMilestone = await tx.query.milestones.findFirst({
        where: eq(milestones.id, oldTask.milestoneId)
    });

    if (!currentMilestone) return null;

    let newMilestoneStatus = currentMilestone.status;

    if (allDone) {
        newMilestoneStatus = "Completed";
    } else if (allReviewOrDone) {
        newMilestoneStatus = "Client Approval";
    } else if (anyActive && currentMilestone.status === "Pending") {
        newMilestoneStatus = "In Progress";
    } else if (anyActive && currentMilestone.status === "Client Approval") {
        newMilestoneStatus = "In Progress";
    }

    if (newMilestoneStatus !== currentMilestone.status) {
        const payload: any = { status: newMilestoneStatus, updatedAt: new Date() };
        if (newMilestoneStatus === "Completed") payload.completedAt = new Date();
        else if (currentMilestone.status === "Completed" && newMilestoneStatus !== "Completed") payload.completedAt = null;

        await tx.update(milestones)
            .set(payload)
            .where(eq(milestones.id, oldTask.milestoneId));

        if (newMilestoneStatus === "Client Approval") {
            await tx.update(tasks)
                .set({ isBlockedByClient: true, status: "Blocked", updatedAt: new Date() })
                .where(and(
                    eq(tasks.milestoneId, oldTask.milestoneId),
                    eq(tasks.status, "In Progress")
                ));
        } else if (currentMilestone.status === "Client Approval") {
            await tx.update(tasks)
                .set({ isBlockedByClient: false, status: "Todo", updatedAt: new Date() })
                .where(and(
                    eq(tasks.milestoneId, oldTask.milestoneId),
                    eq(tasks.isBlockedByClient, true)
                ));
        }

        await syncProjectStatus(tx, oldTask.projectId);
        
        return {
            milestoneId: currentMilestone.id,
            title: currentMilestone.title,
            projectId: currentMilestone.projectId,
            oldStatus: currentMilestone.status,
            newStatus: newMilestoneStatus
        };
    }
    
    return null;
}

export async function syncProjectStatus(tx: any, projectId: string) {
    const { isNull, and, eq } = await import("drizzle-orm");
    const { milestones, agencyProjects } = await import("@/db/schema");
    
    const allMilestones = await tx.query.milestones.findMany({
        where: and(eq(milestones.projectId, projectId), isNull(milestones.deletedAt))
    });
    
    if (allMilestones.length === 0) return;
    
    const allMsCompleted = allMilestones.every((m: any) => m.status === "Completed");
    
    if (allMsCompleted) {
        await tx.update(agencyProjects)
            .set({ status: "Completed", updatedAt: new Date() })
            .where(eq(agencyProjects.id, projectId));
    } else {
        await tx.update(agencyProjects)
            .set({ status: "In Progress", updatedAt: new Date() })
            .where(and(eq(agencyProjects.id, projectId), eq(agencyProjects.status, "Completed")));
    }
}

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
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized: Admins & Managers only." };
    }

    try {
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

        await logAction("UPDATE", "Project Details", `Project ${projectId} details updated`);

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
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const oldProject = await db.query.agencyProjects.findFirst({ where: eq(agencyProjects.id, projectId) });

        await db.update(agencyProjects)
            .set({ status, updatedAt: new Date() })
            .where(eq(agencyProjects.id, projectId));

        await logAction("UPDATE", "Project", `Project ${projectId} status updated to ${status}`);

        const { notifyProjectClients } = await import("@/features/notifications/actions");
        await notifyProjectClients(
            projectId,
            `Project Status Update: "${oldProject?.title || 'Your project'}" has moved to status '${status}'.`,
            "project",
            "/portal"
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
    if (!hasRole(session, ["superadmin", "manager"])) {
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

        await db.update(agencyProjects).set(updatePayload).where(eq(agencyProjects.id, projectId));

        await logAction("UPDATE", "Project Resources", `Project ${projectId} resources updated`);

        if (stagingUrls && stagingUrls.length > 0) {
            const { notifyProjectClients } = await import("@/features/notifications/actions");
            await notifyProjectClients(
                projectId,
                `Staging Environment Updated: New preview & staging links are available for your project.`,
                "project",
                "/portal"
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

export async function addProjectDocument(projectId: string, newDoc: ProjectDocumentItem): Promise<ActionState> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const { sql } = await import("drizzle-orm");
        await db.update(agencyProjects)
            .set({
                documents: sql`COALESCE(${agencyProjects.documents}, '[]'::jsonb) || ${JSON.stringify([newDoc])}::jsonb`,
                updatedAt: new Date()
            })
            .where(eq(agencyProjects.id, projectId));

        await logAction("CREATE", "Project Document", `Added document '${newDoc.title}' to Project ${projectId}`, session.user.id);

        if (newDoc.uploadedByRole === "agency") {
            const { notifyProjectClients } = await import("@/features/notifications/actions");
            await notifyProjectClients(
                projectId,
                `New Resource Uploaded: The agency uploaded "${newDoc.title}" to your project resources.`,
                "document",
                "/portal"
            );
        } else {
            const { notifyAllAdmins } = await import("@/features/notifications/actions");
            await notifyAllAdmins(
                `Client uploaded document "${newDoc.title}" to project resources`,
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
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "Unauthorized" };
    }

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

        await logAction("DELETE", "Project Document", `Deleted document '${docToDelete.title}' from Project ${projectId}`, session.user.id);

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
export async function updateMilestoneStatus(milestoneId: string, status: "Pending" | "In Progress" | "Client Approval" | "Completed"): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db.transaction(async (tx) => {
            await tx.update(milestones)
                .set({ status, updatedAt: new Date() })
                .where(eq(milestones.id, milestoneId));

            // DEPENDENCY LOGIC:
        // If a milestone enters "Client Approval", automatically block all of its active tasks.
        if (status === "Client Approval") {
            await tx.update(tasks)
                .set({ isBlockedByClient: true, status: "Blocked", updatedAt: new Date() })
                .where(and(
                    eq(tasks.milestoneId, milestoneId),
                    eq(tasks.status, "In Progress") // Only block active tasks
                ));
        } else {
            // If moving out of Client Approval, unblock tasks that were blocked by client
            await tx.update(tasks)
                .set({ isBlockedByClient: false, status: "Todo", updatedAt: new Date() })
                .where(and(
                    eq(tasks.milestoneId, milestoneId),
                    eq(tasks.isBlockedByClient, true)
                ));
        }

        const milestone = await tx.query.milestones.findFirst({
            where: eq(milestones.id, milestoneId),
            with: { project: true }
        });

        if (milestone) {
            await syncProjectStatus(tx, milestone.projectId);
        }
    });

    const milestone = await db.query.milestones.findFirst({
        where: eq(milestones.id, milestoneId),
        with: { project: true }
    });

    await logAction("UPDATE", "Milestone", `Milestone ${milestoneId} moved to ${status}`);

        if (milestone) {
            let clientNotice = "";
            if (status === "Client Approval") {
                clientNotice = `Review Required: Milestone "${milestone.title}" is ready for your review and digital sign-off.`;
            } else if (status === "Completed") {
                clientNotice = `Milestone Completed: "${milestone.title}" has been completed!`;
            } else if (status === "In Progress") {
                clientNotice = `Milestone In Progress: Work has started on "${milestone.title}".`;
            }

            if (clientNotice) {
                const { notifyProjectClients } = await import("@/features/notifications/actions");
                await notifyProjectClients(milestone.projectId, clientNotice, "milestone", "/portal");
            }
        }

        revalidatePath("/dashboard/pm/[id]");
        revalidatePath("/portal");
        return { success: true, message: `Milestone moved to ${status}` };
    } catch (error) {
        console.error("Failed to update milestone status:", error);
        return { success: false, message: "Database Error" };
    }
}

// --- Task Actions ---
export async function createTask(
    projectId: string, 
    milestoneId: string, 
    title: string, 
    description?: string, 
    assigneeIds?: string[],
    weight: number = 1,
    estimatedHours?: number
): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    if (!title.trim()) return { success: false, message: "Title is required" };

    try {
        const cleanAssigneeIds = Array.from(new Set((assigneeIds || []).filter(Boolean)));

        // Check dependency logic on creation
        const parentMilestone = await db.query.milestones.findFirst({
            where: eq(milestones.id, milestoneId)
        });

        const isParentBlocked = parentMilestone?.status === "Client Approval";

        const [newTask] = await db.insert(tasks).values({
            projectId,
            milestoneId,
            title,
            description,
            status: isParentBlocked ? "Blocked" : "Todo",
            isBlockedByClient: isParentBlocked,
            weight: weight || 1,
            estimatedHours: estimatedHours || null
        }).returning();

        if (cleanAssigneeIds.length > 0) {
            const { taskAssignees } = await import("@/db/schema");
            await db.insert(taskAssignees).values(
                cleanAssigneeIds.map(userId => ({ taskId: newTask.id, userId }))
            );
        }

        await logAction("CREATE", "Task", `Task "${title}" created`);

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task created.", task: newTask };
    } catch (error) {
        console.error("Failed to create task:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function updateTaskStatus(taskId: string, status: "Todo" | "In Progress" | "Blocked" | "Changes Requested" | "In Review" | "Done", proofLinks?: { label: string, url: string }[], proofNotes?: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "developer"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        // Editor can only update tasks that are explicitly assigned to them.
        if (session.user.role === "developer") {
            const editorId = session.user.id;
            if (!editorId) return { success: false, message: "Unauthorized" };
            const assignment = await db.query.taskAssignees.findFirst({
                where: and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, editorId)),
            });
            if (!assignment) {
                return { success: false, message: "Unauthorized: Task not assigned to you" };
            }
        }

        const oldTask = await db.query.tasks.findFirst({
            where: eq(tasks.id, taskId),
            with: { milestone: { with: { project: { with: { stakeholders: { with: { user: true } } } } } } }
        });

        if (!oldTask) return { success: false, message: "Task not found" };

        // Server-side dependency enforcement: Cannot move task forward if parent task is incomplete
        if (oldTask.dependsOnTaskId && ["In Progress", "In Review", "Done"].includes(status)) {
            const parentTask = await db.query.tasks.findFirst({
                where: eq(tasks.id, oldTask.dependsOnTaskId),
            });
            if (parentTask && parentTask.status !== "Done") {
                return { success: false, message: `Cannot move task: Prerequisite task "${parentTask.title}" is not completed yet.` };
            }
        }

        if (status === "Done" && oldTask.requiresProof && !hasRole(session, ["superadmin", "manager"])) {
            return { success: false, message: "Only Managers and Superadmins can approve tasks to Done." };
        }

        if (status === "In Review" && oldTask.requiresProof && (!proofLinks || proofLinks.length === 0) && !proofNotes) {
            return { success: false, message: "Proof Links or Notes are required for review." };
        }

        const wasBlocked = oldTask.isBlockedByClient;
        const isNowBlocked = status === "Blocked";

        const updateData: Record<string, unknown> = { status, isBlockedByClient: isNowBlocked, updatedAt: new Date() };
        if (status === "In Review" || status === "Done") {
            if (proofLinks !== undefined) updateData.proofLinks = proofLinks || [];
            if (proofNotes !== undefined) updateData.proofNotes = proofNotes;
        }

        if (status === "Done") {
            updateData.completedAt = new Date();
        } else if (oldTask.status === "Done") {
            updateData.completedAt = null;
        }

        let bubbledMilestone: any = null;

        await db.transaction(async (tx) => {
            await tx.update(tasks)
                .set(updateData)
                .where(eq(tasks.id, taskId));

            bubbledMilestone = await handleMilestoneBubbling(tx, taskId, status, oldTask);
        });

        if (bubbledMilestone) {
            let clientNotice = "";
            if (bubbledMilestone.newStatus === "Client Approval") {
                clientNotice = `Review Required: Milestone "${bubbledMilestone.title}" is ready for your review and digital sign-off.`;
            } else if (bubbledMilestone.newStatus === "Completed") {
                clientNotice = `Milestone Completed: "${bubbledMilestone.title}" has been completed!`;
            } else if (bubbledMilestone.newStatus === "In Progress") {
                clientNotice = `Milestone In Progress: Work has started on "${bubbledMilestone.title}".`;
            }
            if (clientNotice) {
                const { notifyProjectClients } = await import("@/features/notifications/actions");
                await notifyProjectClients(bubbledMilestone.projectId, clientNotice, "milestone", "/portal");
            }
        }

        if (!wasBlocked && isNowBlocked) {
            const stakeholders = oldTask.milestone?.project?.stakeholders || [];
            const emails = stakeholders.map(s => s.user?.email).filter(Boolean) as string[];
            
            if (emails.length > 0) {
                const { sendTaskBlockedEmail } = await import("@/lib/notifications");
                await sendTaskBlockedEmail(emails, oldTask.milestone?.project?.title || "Your Project", oldTask.title);
            }
        }

        await logAction("UPDATE", "Task", `Task ${taskId} status updated to ${status}`);

        if (oldTask.projectId) {
            revalidatePath(`/dashboard/pm/${oldTask.projectId}`);
        }
        revalidatePath("/dashboard/pm/[id]", "page");
        return { success: true, message: "Task updated." };
    } catch (error) {
        console.error("Failed to update task status:", error);
        await logSystemError(error, {
            errorCode: "TASK_STATUS_UPDATE_FAILURE",
            severity: "MEDIUM",
            source: "action:pm:updateTaskStatus",
            context: { taskId, status },
            userId: session?.user?.id,
        });
        return { success: false, message: "Database Error" };
    }
}

export async function submitTaskProofAndMove(taskId: string, newStatus: "In Review" | "Done", proofLinks?: { label: string; url: string }[], proofNotes?: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "developer"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        if (session.user.role === "developer") {
            const editorId = session.user.id;
            if (!editorId) return { success: false, message: "Unauthorized" };
            const assignment = await db.query.taskAssignees.findFirst({
                where: and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, editorId)),
            });
            if (!assignment) {
                return { success: false, message: "Unauthorized: Task not assigned to you" };
            }
        }

        const oldTask = await db.query.tasks.findFirst({
            where: eq(tasks.id, taskId),
            with: { milestone: { with: { project: true } } }
        });

        if (!oldTask) return { success: false, message: "Task not found" };

        // Server-side dependency enforcement
        if (oldTask.dependsOnTaskId && ["In Progress", "In Review", "Done"].includes(newStatus)) {
            const parentTask = await db.query.tasks.findFirst({
                where: eq(tasks.id, oldTask.dependsOnTaskId),
            });
            if (parentTask && parentTask.status !== "Done") {
                return { success: false, message: `Cannot move task: Prerequisite task "${parentTask.title}" is not completed yet.` };
            }
        }

        if (newStatus === "Done" && oldTask.requiresProof && !hasRole(session, ["superadmin", "manager"])) {
            return { success: false, message: "Only Managers and Superadmins can approve tasks to Done." };
        }

        if ((newStatus === "In Review" || newStatus === "Done") && oldTask.requiresProof) {
            if ((!proofLinks || proofLinks.length === 0) && !proofNotes) {
                return { success: false, message: "Proof Links or Notes are required." };
            }
            if (proofLinks && proofLinks.length > 0) {
                for (const link of proofLinks) {
                    try {
                        new URL(link.url);
                    } catch {
                        return { success: false, message: `Invalid Proof URL format: ${link.url}` };
                    }
                }
            }
        }

        if (newStatus === "In Review") {
            const firstUrl = proofLinks && proofLinks[0]?.url ? proofLinks[0].url : "";
            const { submitTaskForVerification } = await import("@/actions/task-quality-gate");
            const gateRes = await submitTaskForVerification({
                taskId,
                proofUrl: firstUrl,
                submissionNotes: proofNotes || "",
            });

            if (!gateRes.success) {
                const errMsg = typeof gateRes.error === "string"
                    ? gateRes.error
                    : "Proof validation failed: Valid URL and minimum 25 characters of deliverable notes required.";
                return { success: false, message: errMsg };
            }

            await logAction(
                "UPDATE",
                "Task",
                `Task ${taskId} evaluated by Quality Gate (Score: ${gateRes.score}%, Status: ${gateRes.passed ? "In Review" : "Changes Requested"})`
            );

            return {
                success: true,
                message: gateRes.passed
                    ? `Quality Gate Passed (${gateRes.score}%)! Task queued for PM sign-off.`
                    : `Quality Gate unverified (${gateRes.score}%). Changes requested.`,
            };
        }

        const updatedProofLinks = proofLinks !== undefined ? proofLinks : oldTask.proofLinks;
        const updatedProofNotes = proofNotes !== undefined ? proofNotes : oldTask.proofNotes;

        let bubbledMilestone: any = null;

        await db.transaction(async (tx) => {
            const updatePayload: Record<string, unknown> = {
                status: newStatus,
                proofLinks: updatedProofLinks || [],
                proofNotes: updatedProofNotes,
                updatedAt: new Date()
            };
            if (newStatus === "Done") {
                updatePayload.completedAt = new Date();
            } else if (oldTask.status === "Done" && newStatus !== "Done") {
                updatePayload.completedAt = null;
            }

            await tx.update(tasks)
                .set(updatePayload)
                .where(eq(tasks.id, taskId));

            bubbledMilestone = await handleMilestoneBubbling(tx, taskId, newStatus, oldTask);
        });

        if (bubbledMilestone) {
            let clientNotice = "";
            if (bubbledMilestone.newStatus === "Client Approval") {
                clientNotice = `Review Required: Milestone "${bubbledMilestone.title}" is ready for your review and digital sign-off.`;
            } else if (bubbledMilestone.newStatus === "Completed") {
                clientNotice = `Milestone Completed: "${bubbledMilestone.title}" has been completed!`;
            } else if (bubbledMilestone.newStatus === "In Progress") {
                clientNotice = `Milestone In Progress: Work has started on "${bubbledMilestone.title}".`;
            }
            if (clientNotice) {
                const { notifyProjectClients } = await import("@/features/notifications/actions");
                await notifyProjectClients(bubbledMilestone.projectId, clientNotice, "milestone", "/portal");
            }
        }

        await logAction("UPDATE", "Task", `Task ${taskId} moved to ${newStatus} with proof`);

        if (oldTask.projectId) {
            revalidatePath(`/dashboard/pm/${oldTask.projectId}`);
        }
        revalidatePath("/dashboard/pm/[id]", "page");
        revalidatePath("/portal");
        return { success: true, message: "Task proof submitted." };
    } catch (error) {
        console.error("Failed to submit task proof:", error);
        await logSystemError(error, {
            errorCode: "TASK_PROOF_SUBMISSION_FAILURE",
            severity: "HIGH",
            source: "action:pm:submitTaskProofAndMove",
            context: { taskId, newStatus },
            userId: session?.user?.id,
        });
        return { success: false, message: "Database Error" };
    }
}

export async function getTaskAuditReport(taskId: string) {
    const { getLatestTaskSubmission } = await import("@/actions/task-quality-gate");
    return getLatestTaskSubmission(taskId);
}

export async function submitTaskBlockedReasonAndMove(taskId: string, blockedReason: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "developer"])) {
        return { success: false, message: "Unauthorized" };
    }

    if (!blockedReason.trim()) {
        return { success: false, message: "Blocked reason is required." };
    }

    try {
        if (session.user.role === "developer") {
            const editorId = session.user.id;
            if (!editorId) return { success: false, message: "Unauthorized" };
            const assignment = await db.query.taskAssignees.findFirst({
                where: and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, editorId)),
            });
            if (!assignment) {
                return { success: false, message: "Unauthorized: Task not assigned to you" };
            }
        }

        const oldTask = await db.query.tasks.findFirst({
            where: eq(tasks.id, taskId),
            with: { milestone: { with: { project: true } } }
        });

        if (!oldTask) return { success: false, message: "Task not found" };

        await db.update(tasks)
            .set({ 
                status: "Blocked", 
                isBlockedByClient: true,
                blockedReason: blockedReason.trim(),
                updatedAt: new Date() 
            })
            .where(eq(tasks.id, taskId));

        // Notify internal team members ONLY (Admins/PMs)
        const allInternalUsers = await db.query.users.findMany({
            where: (users, { inArray }) => inArray(users.role, ["superadmin", "manager", "developer", "content_editor"]),
            columns: { email: true }
        });
        const emails = allInternalUsers.map(u => u.email).filter(Boolean) as string[];
        
        if (emails.length > 0) {
            const { sendTaskBlockedEmail } = await import("@/lib/notifications");
            await sendTaskBlockedEmail(emails, oldTask.milestone?.project?.title || "Your Project", oldTask.title);
        }

        await logAction("UPDATE", "Task", `Task ${taskId} blocked with reason: ${blockedReason.trim()}`);

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task blocked with reason." };
    } catch (error) {
        console.error("Failed to block task:", error);
        return { success: false, message: "Database Error" };
    }
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
    if (!hasRole(session, ["superadmin", "manager", "developer"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        // Editor can only update tasks that are explicitly assigned to them.
        if (session.user.role === "developer") {
            const editorId = session.user.id;
            if (!editorId) return { success: false, message: "Unauthorized" };
            const assignment = await db.query.taskAssignees.findFirst({
                where: and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, editorId)),
            });
            if (!assignment) {
                return { success: false, message: "Unauthorized: Task not assigned to you" };
            }
        }

        const existingTask = await db.query.tasks.findFirst({
            where: eq(tasks.id, taskId),
            columns: { projectId: true },
        });
        if (!existingTask) return { success: false, message: "Task not found" };

        const cleanAssigneeIds = data.assigneeIds !== undefined
            ? Array.from(new Set((data.assigneeIds || []).filter(Boolean)))
            : undefined;

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

        await logAction("UPDATE", "Task", `Task ${taskId} details updated`);

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task details updated.", task: updatedTask };
    } catch (error) {
        console.error("Failed to update task details:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function deleteTask(taskId: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await db.update(tasks)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(tasks.id, taskId));
        
        await logAction("DELETE", "Task", `Task ${taskId} soft-deleted`);
        
        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Task deleted." };
    } catch (error) {
        console.error("Failed to delete task:", error);
        return { success: false, message: "Database Error" };
    }
}

// --- Milestone Management ---
export async function createMilestone(projectId: string, title: string): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const existings = await db.query.milestones.findMany({
            where: eq(milestones.projectId, projectId),
            orderBy: [desc(milestones.order)]
        });
        const newOrder = existings.length > 0 ? existings[0].order + 1 : 1;

        const [newMilestone] = await db.insert(milestones).values({
            projectId,
            title,
            order: newOrder,
            status: "Pending"
        }).returning();

        await logAction("CREATE", "Milestone", `Milestone "${title}" created`);

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Milestone created.", milestone: newMilestone };
    } catch (error) {
        console.error("Failed to create milestone:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function editMilestone(milestoneId: string, title: string, order?: number): Promise<ActionState> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized" };
    }

    if (!title || !title.trim()) {
        return { success: false, message: "Milestone title cannot be empty." };
    }

    try {
        const currentMilestone = await db.query.milestones.findFirst({
            where: eq(milestones.id, milestoneId)
        });

        if (!currentMilestone) {
            return { success: false, message: "Milestone not found." };
        }

        const trimmedTitle = title.trim();

        // If order is specified and valid, re-sequence all milestones in the project so there are never duplicate numbers
        if (typeof order === "number" && !isNaN(order)) {
            const allMilestones = await db.query.milestones.findMany({
                where: and(
                    eq(milestones.projectId, currentMilestone.projectId),
                    isNull(milestones.deletedAt)
                ),
                orderBy: [milestones.order]
            });

            const remaining = allMilestones.filter((m) => m.id !== milestoneId);
            const targetIndex = Math.max(0, Math.min(order - 1, remaining.length));
            remaining.splice(targetIndex, 0, {
                ...currentMilestone,
                title: trimmedTitle
            });

            await db.transaction(async (tx) => {
                for (let i = 0; i < remaining.length; i++) {
                    const m = remaining[i];
                    const newSeq = i + 1;
                    if (m.id === milestoneId) {
                        await tx.update(milestones).set({
                            title: trimmedTitle,
                            order: newSeq,
                            updatedAt: new Date()
                        }).where(eq(milestones.id, m.id));
                    } else if (m.order !== newSeq) {
                        await tx.update(milestones).set({
                            order: newSeq,
                            updatedAt: new Date()
                        }).where(eq(milestones.id, m.id));
                    }
                }
            });
        } else {
            await db.update(milestones).set({
                title: trimmedTitle,
                updatedAt: new Date()
            }).where(eq(milestones.id, milestoneId));
        }

        await logAction("UPDATE", "Milestone", `Milestone "${trimmedTitle}" (${milestoneId}) updated`);

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Milestone updated." };
    } catch (error) {
        console.error("Failed to update milestone:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function deleteMilestone(milestoneId: string): Promise<ActionState> {
    const session = await auth();
    // Restrict deletion to admin only
    if (!hasRole(session, ["superadmin", "manager"])) {
        return { success: false, message: "Unauthorized: Only Admins can delete milestones." };
    }

    try {
        await db.delete(tasks).where(eq(tasks.milestoneId, milestoneId));
        await db.delete(milestones).where(eq(milestones.id, milestoneId));

        await logAction("DELETE", "Milestone", `Milestone ${milestoneId} deleted`);

        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Milestone deleted." };
    } catch (error) {
        console.error("Failed to delete milestone:", error);
        return { success: false, message: "Database Error" };
    }
}

// --- Client Feedback Actions ---
export async function submitMilestoneFeedback(milestoneId: string, status: "APPROVED" | "REVISION_REQUESTED", commentText?: string, attachmentUrl?: string | null, attachmentName?: string | null): Promise<ActionState> {
    const session = await auth();
    if (!session?.user?.id || !["client", "superadmin"].includes(session.user.role || "")) {
        return { success: false, message: "Unauthorized" };
    }

    if (status === "REVISION_REQUESTED" && (!commentText || !commentText.trim())) {
        return { success: false, message: "Comment is required for revision requests." };
    }

    try {
        const { clientFeedback } = await import("@/db/schema");
        const { desc, or } = await import("drizzle-orm");

        const milestone = await db.query.milestones.findFirst({ where: eq(milestones.id, milestoneId) });
        if (!milestone) return { success: false, message: "Milestone not found" };

        // Ownership: only stakeholders for the milestone's project can submit feedback (or superadmin).
        const isSuperAdmin = session.user.role === "superadmin";
        const stakeholder = await db.query.projectStakeholders.findFirst({
            where: and(
                eq(projectStakeholders.projectId, milestone.projectId),
                eq(projectStakeholders.userId, session.user.id)
            )
        });
        if (!stakeholder && !isSuperAdmin) return { success: false, message: "Unauthorized: Feedback ownership mismatch" };

        // Find the latest feedback for version chaining (threading)
        const latestFeedback = await db.query.clientFeedback.findFirst({
            where: eq(clientFeedback.milestoneId, milestoneId),
            orderBy: [desc(clientFeedback.createdAt)]
        });

        await db.transaction(async (tx) => {
            await tx.insert(clientFeedback).values({
                milestoneId,
                clientId: session.user.id!,
                status,
                commentText: commentText?.trim() || null,
                attachmentUrl: attachmentUrl || null,
                attachmentName: attachmentName || null,
                parentFeedbackId: latestFeedback?.id || null, // Create threaded version link
            });

            if (status === "APPROVED") {
                await tx.update(tasks)
                    .set({ isBlockedByClient: false, status: "Done", updatedAt: new Date() })
                    .where(
                        and(
                            eq(tasks.milestoneId, milestoneId),
                            or(
                                eq(tasks.isBlockedByClient, true),
                                eq(tasks.status, "In Review")
                            )
                        )
                    );
            } else {
                // UNBLOCK ASSIGNED TASKS THAT ARE BLOCKED BY CLIENT (Revision requested)
                await tx.update(tasks)
                    .set({ isBlockedByClient: false, status: "Todo", updatedAt: new Date() })
                    .where(and(eq(tasks.milestoneId, milestoneId), eq(tasks.isBlockedByClient, true)));
            }

            // Client feedback should deterministically drive milestone status.
            const newMilestoneStatus = status === "REVISION_REQUESTED" ? "In Progress" : "Completed";
            await tx.update(milestones)
                .set({ status: newMilestoneStatus, updatedAt: new Date() })
                .where(eq(milestones.id, milestoneId));
                
            await syncProjectStatus(tx, milestone.projectId);
        });

        if (status === "REVISION_REQUESTED") {
            await notifyAllAdmins(`${session.user.name || "Client"} requested a revision for: ${milestone.title}`, "feedback", `/dashboard/pm/${milestone.projectId}`);
        } else if (status === "APPROVED") {
            await notifyAllAdmins(`${session.user.name || "Client"} approved milestone: ${milestone.title}`, "feedback", `/dashboard/pm/${milestone.projectId}`);
        }

        await logAction("UPDATE", "Milestone Feedback", `Feedback ${status} submitted for Milestone ${milestoneId}`);

        revalidatePath("/portal");
        revalidatePath("/dashboard/pm/[id]");
        return { success: true, message: "Feedback submitted successfully." };
    } catch (error) {
        console.error("Failed to submit feedback:", error);
        return { success: false, message: "Database Error" };
    }
}

// --- Deadline Tracking ---
export async function checkAndNotifyOverdueTasks(): Promise<{ success: boolean; found: number }> {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager"])) {
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
                ne(tasks.status, "Done"),
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

        const { notifyAllAdmins, createSystemNotification } = await import("@/features/notifications/actions");
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
    if (!hasRole(session, ["superadmin"])) {
        return { success: false, message: "Unauthorized: Admins only." };
    }

    try {
        await db.update(agencyProjects)
            .set({ isArchived: true, updatedAt: new Date() })
            .where(eq(agencyProjects.id, projectId));

        await logAction("UPDATE", "Project", `Project ${projectId} archived.`);

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
    if (!hasRole(session, ["superadmin"])) {
        return { success: false, message: "Unauthorized: Admins only." };
    }

    try {
        await db.update(agencyProjects)
            .set({ isArchived: false, updatedAt: new Date() })
            .where(eq(agencyProjects.id, projectId));

        await logAction("UPDATE", "Project", `Project ${projectId} unarchived.`);

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
    const session = await auth();
    if (!session?.user) return [];
    return db.query.users.findMany({
        where: eq(users.role, "client"),
        columns: { id: true, name: true, email: true, image: true },
        orderBy: (u, { asc }) => [asc(u.name)],
    });
}
