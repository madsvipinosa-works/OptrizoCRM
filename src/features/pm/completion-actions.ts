"use server";

import { db } from "@/db";
import { agencyProjects, document, milestones, payments } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth, hasRole } from "@/auth";
import { validateFileUrlForProject } from "@/lib/authz";
import { logAction } from "@/features/audit/log";
import { notifyProjectClients } from "@/features/notifications/send";
import { sendProjectCompleteEmail } from "@/lib/notifications";
import { getBaseUrl } from "@/lib/email-templates";

/**
 * Uploads/attaches a handover document to a project.
 * Manager-only. Allowed only while project is not yet Completed.
 */
export async function addHandoverFile(
    projectId: string,
    data: {
        title: string;
        fileUrl: string;
        fileName: string;
        fileSize?: number;
    }
): Promise<{ success: boolean; error?: string; message?: string }> {
    const session = await auth();
    if (!session?.user?.id || !hasRole(session, ["manager"])) {
        return { success: false, error: "Unauthorized: Managers only." };
    }

    if (!projectId || !data) {
        return { success: false, error: "Project ID and file details are required." };
    }

    const title = (data.title || "").trim();
    const fileName = (data.fileName || "").trim();
    const fileUrl = (data.fileUrl || "").trim();

    if (!title) return { success: false, error: "Document title is required." };
    if (!fileName) return { success: false, error: "File name is required." };
    if (!fileUrl) return { success: false, error: "File URL is required." };

    try {
        const project = await db.query.agencyProjects.findFirst({
            where: eq(agencyProjects.id, projectId),
            columns: { id: true, status: true, isArchived: true },
        });

        if (!project || project.isArchived) {
            return { success: false, error: "Project not found or archived." };
        }

        if (project.status === "Completed") {
            return { success: false, error: "Cannot add handover files to a completed project." };
        }

        const fileValidation = await validateFileUrlForProject(projectId, fileUrl);
        if (!fileValidation.ok) {
            return { success: false, error: fileValidation.error };
        }

        await db.insert(document).values({
            projectId,
            title,
            fileUrl,
            fileName,
            fileSize: data.fileSize || null,
            uploadedBy: session.user.id,
        });

        await logAction(
            "CREATE",
            "Document",
            `Added handover file "${title}" (${fileName}) to project ${project.id}`,
            session.user.id,
            project.id
        );

        revalidatePath(`/dashboard/pm/${projectId}/complete`);
        revalidatePath(`/dashboard/pm/${projectId}`);
        revalidatePath(`/portal/projects/${projectId}`);
        revalidatePath(`/portal/documents`);

        return { success: true, message: "Handover file added successfully." };
    } catch (error: unknown) {
        console.error("addHandoverFile error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to add handover file.",
        };
    }
}

/**
 * Records formal client sign-off metadata on the project.
 * Manager-only. Does not require final payment to be confirmed first.
 */
export async function recordSignOff(
    projectId: string,
    data: {
        signOffFileUrl: string;
        signedOffAt?: Date | string;
    }
): Promise<{ success: boolean; error?: string; message?: string }> {
    const session = await auth();
    if (!session?.user?.id || !hasRole(session, ["manager"])) {
        return { success: false, error: "Unauthorized: Managers only." };
    }

    if (!projectId || !data?.signOffFileUrl) {
        return { success: false, error: "Project ID and sign-off document URL are required." };
    }

    const signOffFileUrl = data.signOffFileUrl.trim();
    const signedOffDate = data.signedOffAt ? new Date(data.signedOffAt) : new Date();

    if (isNaN(signedOffDate.getTime())) {
        return { success: false, error: "Invalid sign-off date." };
    }

    if (signedOffDate > new Date()) {
        return { success: false, error: "Sign-off date cannot be in the future." };
    }

    try {
        const txResult = await db.transaction(async (tx) => {
            const [project] = await tx
                .select()
                .from(agencyProjects)
                .where(eq(agencyProjects.id, projectId))
                .for("update");

            if (!project || project.isArchived) {
                return { success: false, error: "Project not found or archived." };
            }

            if (project.status === "Completed") {
                return { success: false, error: "Sign-off cannot be modified on a completed project." };
            }

            const fileValidation = await validateFileUrlForProject(projectId, signOffFileUrl);
            if (!fileValidation.ok) {
                return { success: false, error: fileValidation.error };
            }

            await tx
                .update(agencyProjects)
                .set({
                    signedOffBy: session.user.id,
                    signedOffAt: signedOffDate,
                    signOffFileUrl,
                    updatedAt: new Date(),
                })
                .where(eq(agencyProjects.id, projectId));

            return { success: true, projectId: project.id };
        });

        if (!txResult.success) {
            return txResult;
        }

        await logAction(
            "UPDATE",
            "Project",
            `Recorded sign-off for project ${txResult.projectId}`,
            session.user.id,
            txResult.projectId
        );

        revalidatePath(`/dashboard/pm/${projectId}/complete`);
        revalidatePath(`/dashboard/pm/${projectId}`);
        revalidatePath(`/portal/projects/${projectId}`);

        return { success: true, message: "Client sign-off recorded successfully." };
    } catch (error: unknown) {
        console.error("recordSignOff error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to record sign-off.",
        };
    }
}

/**
 * Executes full project completion:
 * 1. Checks all milestones Completed (count >= 1).
 * 2. Checks final payment (highest schedule sortOrder) is paid.
 * 3. Checks at least one handover file exists in document table.
 * 4. Checks formal sign-off is recorded.
 * 5. Sets status = 'Completed', completed_at = now, warranty_ends_at = now + 3 months (from same timestamp).
 * 6. Sends completion email and portal notification.
 */
export async function completeProject(
    projectId: string
): Promise<{ success: boolean; error?: string; message?: string }> {
    const session = await auth();
    if (!session?.user?.id || !hasRole(session, ["manager"])) {
        return { success: false, error: "Unauthorized: Managers only." };
    }

    if (!projectId) {
        return { success: false, error: "Project ID is required." };
    }

    try {
        let resolvedProjectId = "";
        let projectTitle = "";
        let finalWarrantyEnd: Date | null = null;

        const txResult = await db.transaction(async (tx) => {
            const [project] = await tx
                .select()
                .from(agencyProjects)
                .where(eq(agencyProjects.id, projectId))
                .for("update");

            if (!project || project.isArchived) {
                return { success: false, error: "Project not found or archived." };
            }

            if (project.status === "Completed") {
                return { success: false, error: "Project is already completed." };
            }

            resolvedProjectId = project.id;
            projectTitle = project.title;

            // 1. Verify all milestones are Completed
            const projectMilestones = await tx.query.milestones.findMany({
                where: and(eq(milestones.projectId, projectId), isNull(milestones.deletedAt)),
                columns: { id: true, title: true, status: true },
            });

            if (projectMilestones.length === 0) {
                return { success: false, error: "Project has no milestones to complete." };
            }

            const uncompletedMilestone = projectMilestones.find((m) => m.status !== "Completed");
            if (uncompletedMilestone) {
                return {
                    success: false,
                    error: `Milestone "${uncompletedMilestone.title}" is not Completed (status: ${uncompletedMilestone.status}).`,
                };
            }

            // 2. Verify final payment is Paid
            const projectPayments = await tx.query.payments.findMany({
                where: eq(payments.projectId, projectId),
                with: {
                    scheduleItem: { columns: { sortOrder: true } },
                },
            });

            if (projectPayments.length === 0) {
                return { success: false, error: "Project has no payment records." };
            }

            const sortedPayments = projectPayments.sort(
                (a, b) => (b.scheduleItem?.sortOrder ?? 0) - (a.scheduleItem?.sortOrder ?? 0)
            );
            const finalPayment = sortedPayments[0];

            if (finalPayment.status !== "paid") {
                return {
                    success: false,
                    error: `Final payment "${finalPayment.label}" must be marked as paid before completion (current status: ${finalPayment.status}).`,
                };
            }

            // 3. Verify handover documents exist
            const handoverFiles = await tx.query.document.findMany({
                where: eq(document.projectId, projectId),
                columns: { id: true },
            });

            if (handoverFiles.length === 0) {
                return {
                    success: false,
                    error: "At least one handover document must be uploaded before completing the project.",
                };
            }

            // 4. Verify sign-off is recorded
            if (!project.signOffFileUrl || !project.signedOffAt) {
                return {
                    success: false,
                    error: "Client sign-off must be recorded before completing the project.",
                };
            }

            // 5. Execute completion with SQL computed timestamps
            const updatedRows = await tx
                .update(agencyProjects)
                .set({
                    status: "Completed",
                    completedAt: sql`now()`,
                    warrantyEndsAt: sql`now() + interval '3 months'`,
                    updatedAt: sql`now()`,
                })
                .where(eq(agencyProjects.id, projectId))
                .returning({
                    completedAt: agencyProjects.completedAt,
                    warrantyEndsAt: agencyProjects.warrantyEndsAt,
                });

            finalWarrantyEnd = updatedRows[0]?.warrantyEndsAt ?? null;

            return { success: true };
        });

        if (!txResult.success) {
            return txResult;
        }

        // Post-commit side effects: client email & notification
        try {
            const projectDetails = await db.query.agencyProjects.findFirst({
                where: eq(agencyProjects.id, projectId),
                with: {
                    lead: {
                        with: { client: true },
                    },
                    stakeholders: {
                        with: { user: true },
                    },
                },
            });

            const clientUser =
                projectDetails?.lead?.client ||
                projectDetails?.stakeholders?.find((s) => s.user?.role === "client")?.user;
            const clientEmail = clientUser?.email || projectDetails?.lead?.contactEmail;

            const portalUrl = `${getBaseUrl()}/portal/projects/${projectId}`;

            if (clientEmail) {
                await sendProjectCompleteEmail({
                    clientEmail,
                    clientName: clientUser?.name || projectDetails?.lead?.contactName || "Client",
                    projectTitle,
                    portalUrl,
                });
            }

            await notifyProjectClients(
                projectId,
                `Project "${projectTitle}" is officially complete! Handover files and warranty details are now available.`,
                "project",
                `/portal/projects/${projectId}`
            );

            await logAction(
                "UPDATE",
                "Project",
                `Completed project "${projectTitle}" (${resolvedProjectId}). Warranty ends: ${finalWarrantyEnd ? (finalWarrantyEnd as Date).toISOString() : "N/A"}`,
                session.user.id,
                resolvedProjectId
            );
        } catch (postCommitErr) {
            console.error("Post-commit error in completeProject:", postCommitErr);
        }

        revalidatePath(`/dashboard/pm/${projectId}/complete`);
        revalidatePath(`/dashboard/pm/${projectId}`);
        revalidatePath("/dashboard/pm");
        revalidatePath(`/portal/projects/${projectId}`);
        revalidatePath("/portal/projects");
        revalidatePath("/portal");

        return { success: true, message: "Project completed successfully." };
    } catch (error: unknown) {
        console.error("completeProject error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to complete project.",
        };
    }
}
