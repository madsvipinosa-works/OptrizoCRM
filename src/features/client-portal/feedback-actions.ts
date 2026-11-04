"use server";

import { db } from "@/db";
import { agencyProjects, projectFeedback } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth, hasRole } from "@/auth";
import { logAction } from "@/features/audit/log";
import { notifyLeadPms } from "@/features/notifications/send";

/**
 * Client submits post-completion feedback (1-5 star rating and optional comment).
 * Only allowed when the project is in 'Completed' status.
 * Single submission per client per project (enforced in code + DB unique index).
 */
export async function submitProjectFeedback(
    projectId: string,
    data: {
        rating: number;
        comment?: string;
    }
): Promise<{ success: boolean; error?: string; message?: string }> {
    const session = await auth();
    if (!session?.user?.id || !hasRole(session, ["client"])) {
        return { success: false, error: "Unauthorized: Clients only." };
    }

    if (!projectId || data === undefined) {
        return { success: false, error: "Project ID and feedback data are required." };
    }

    if (typeof data?.rating !== "number" || !Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
        return { success: false, error: "Rating must be an integer between 1 and 5." };
    }

    if (data.comment && data.comment.length > 2000) {
        return { success: false, error: "Comment cannot exceed 2000 characters." };
    }

    const rating = data.rating;
    const comment = data.comment ? data.comment.trim() : null;

    try {
        let resolvedProjectId = "";
        let leadId: string | null = null;
        let projectTitle = "";

        const txResult = await db.transaction(async (tx) => {
            const project = await tx.query.agencyProjects.findFirst({
                where: eq(agencyProjects.id, projectId),
                columns: { id: true, title: true, status: true, isArchived: true, leadId: true },
                with: {
                    lead: { columns: { clientId: true } },
                    stakeholders: { columns: { userId: true } },
                },
            });

            if (!project || project.isArchived) {
                return { success: false, error: "Project not found or archived." };
            }

            resolvedProjectId = project.id;
            leadId = project.leadId;
            projectTitle = project.title;

            // Enforce ownership
            const isClientOwner =
                project.lead?.clientId === session.user.id ||
                project.stakeholders.some((s) => s.userId === session.user.id);

            if (!isClientOwner) {
                return { success: false, error: "Unauthorized access to project feedback." };
            }

            // Only completed projects accept feedback
            if (project.status !== "Completed") {
                return {
                    success: false,
                    error: "Project feedback can only be submitted after the project is completed.",
                };
            }

            // Enforce single submission per client
            const existingFeedback = await tx.query.projectFeedback.findFirst({
                where: and(
                    eq(projectFeedback.projectId, projectId),
                    eq(projectFeedback.clientId, session.user.id)
                ),
                columns: { id: true },
            });

            if (existingFeedback) {
                return {
                    success: false,
                    error: "You have already submitted feedback for this project.",
                };
            }

            await tx.insert(projectFeedback).values({
                projectId,
                clientId: session.user.id,
                rating,
                comment,
            });

            return { success: true };
        });

        if (!txResult.success) {
            return txResult;
        }

        // Post-commit side effects: notify PM and log audit
        try {
            if (leadId) {
                await notifyLeadPms(
                    leadId,
                    `Client submitted feedback for "${projectTitle}" (Rating: ${rating}/5).`,
                    "feedback",
                    `/dashboard/pm/${projectId}`
                );
            }

            await logAction(
                "CREATE",
                "Feedback",
                `Submitted project feedback for ${resolvedProjectId} (Rating: ${rating}/5)`,
                session.user.id,
                resolvedProjectId
            );
        } catch (postCommitErr) {
            console.error("Post-commit error in submitProjectFeedback:", postCommitErr);
        }

        revalidatePath(`/portal/projects/${projectId}`);
        revalidatePath(`/dashboard/pm/${projectId}`);
        revalidatePath("/portal");

        return { success: true, message: "Thank you for your feedback!" };
    } catch (error: unknown) {
        const errObj = error as { code?: string; cause?: { code?: string } } | null;
        const isUniqueViolation = errObj?.code === "23505" || errObj?.cause?.code === "23505";
        if (isUniqueViolation) {
            return {
                success: false,
                error: "You have already submitted feedback for this project.",
            };
        }
        console.error("submitProjectFeedback error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to submit project feedback.",
        };
    }
}

