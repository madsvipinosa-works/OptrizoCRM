"use server";

import { db } from "@/db";
import { users, agencyProjects, projectTeamMembers, taskAssignees, tasks } from "@/db/schema";
import { eq, and, ne, isNull } from "drizzle-orm";
import { requireRole } from "@/lib/authz";
import { createSystemNotification } from "@/features/notifications/send";
import { logAction } from "@/features/audit/log";
import { revalidatePath } from "next/cache";

/**
 * Step 22a: Project Manager adds a developer to a project's team.
 * Role: manager.
 * User must exist, be active, and have role 'developer'.
 * Inserts project_team_member with addedBy = session.user.id.
 */
export async function addProjectTeamMember(
    projectId: string,
    userId: string
): Promise<{ success: boolean; message?: string }> {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can add project team members" };
    }

    if (!projectId || !userId) {
        return { success: false, message: "Project ID and User ID are required" };
    }

    try {
        const targetUser = await db.query.users.findFirst({
            where: and(
                eq(users.id, userId),
                isNull(users.deletedAt),
                eq(users.isActive, true)
            ),
        });

        if (!targetUser || targetUser.role !== "developer" || !targetUser.isActive) {
            return { success: false, message: "Only active developers can be added to project teams" };
        }

        const project = await db.query.agencyProjects.findFirst({
            where: and(eq(agencyProjects.id, projectId), isNull(agencyProjects.deletedAt)),
        });

        if (!project) {
            return { success: false, message: "Project not found" };
        }

        await db.insert(projectTeamMembers).values({
            projectId,
            userId,
            addedBy: authz.session.user.id,
        }).onConflictDoNothing();

        try {
            await createSystemNotification(
                userId,
                `You were added to the project team for "${project.title}"`,
                "project",
                `/dashboard/pm/${projectId}`
            );
            await logAction(
                "CREATE",
                "project_team_member",
                `Added developer ${targetUser.name || targetUser.email} to project "${project.title}"`
            );
        } catch (postCommitErr) {
            console.error("Post-commit error in addProjectTeamMember:", postCommitErr);
        }

        revalidatePath(`/dashboard/pm/${projectId}`);
        revalidatePath(`/dashboard/pm/${projectId}/team`);
        return { success: true };
    } catch (error: unknown) {
        console.error("addProjectTeamMember error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to add team member",
        };
    }
}

/**
 * Step 22a: Project Manager removes a developer from a project's team.
 * Role: manager.
 * Reassigns the removed member's open tasks to the removing PM, notifies, and removes membership.
 */
export async function removeProjectTeamMember(
    projectId: string,
    userId: string
): Promise<{ success: boolean; message?: string }> {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can remove project team members" };
    }

    if (!projectId || !userId) {
        return { success: false, message: "Project ID and User ID are required" };
    }

    try {
        const project = await db.query.agencyProjects.findFirst({
            where: and(eq(agencyProjects.id, projectId), isNull(agencyProjects.deletedAt)),
        });

        if (!project) {
            return { success: false, message: "Project not found" };
        }

        let reassignedCount = 0;

        await db.transaction(async (tx) => {
            // Reassign open (not done) tasks assigned to this developer to the removing PM
            const openAssignedTasks = await tx
                .select({ taskId: taskAssignees.taskId })
                .from(taskAssignees)
                .innerJoin(tasks, eq(tasks.id, taskAssignees.taskId))
                .where(and(
                    eq(tasks.projectId, projectId),
                    eq(taskAssignees.userId, userId),
                    ne(tasks.status, "done"),
                    isNull(tasks.deletedAt)
                ));

            for (const row of openAssignedTasks) {
                // Delete developer assignment
                await tx.delete(taskAssignees).where(and(
                    eq(taskAssignees.taskId, row.taskId),
                    eq(taskAssignees.userId, userId)
                ));
                // Assign to removing PM
                await tx.insert(taskAssignees).values({
                    taskId: row.taskId,
                    userId: authz.session.user.id,
                }).onConflictDoNothing();
                reassignedCount++;
            }

            // Remove project team member record
            await tx.delete(projectTeamMembers).where(and(
                eq(projectTeamMembers.projectId, projectId),
                eq(projectTeamMembers.userId, userId)
            ));
        });

        try {
            await createSystemNotification(
                userId,
                `You were removed from the project team for "${project.title}"${reassignedCount > 0 ? ` (${reassignedCount} open task(s) reassigned)` : ""}`,
                "project"
            );
            await logAction(
                "DELETE",
                "project_team_member",
                `Removed developer ${userId} from project "${project.title}" (reassigned ${reassignedCount} open tasks)`
            );
        } catch (postCommitErr) {
            console.error("Post-commit error in removeProjectTeamMember:", postCommitErr);
        }

        revalidatePath(`/dashboard/pm/${projectId}`);
        revalidatePath(`/dashboard/pm/${projectId}/team`);
        return { success: true };
    } catch (error: unknown) {
        console.error("removeProjectTeamMember error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Failed to remove team member",
        };
    }
}

