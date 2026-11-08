"use server";

import { db } from "@/db";
import { agencyProjects, document, milestones, payments } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth, hasRole } from "@/auth";
import { validateFileUrlForProject } from "@/lib/authz";
import { logAction } from "@/features/audit/log";
import { notifyProjectClients } from "@/features/notifications/send";
import { sendHandoverReviewEmail, sendProjectCompleteEmail } from "@/lib/notifications";
import { getBaseUrl } from "@/lib/email-templates";
import { ACCEPTANCE_WAIT_DAYS, acceptanceState, canAssumeAcceptance } from "@/features/pm/acceptance-state";
import { getClientProjectIds } from "@/features/client-portal/queries";
import { notifyLeadPms, notifyAllAdmins } from "@/features/notifications/send";

// A hand-off to the PM must reach someone: the lead's PM, or every PM when there is no lead (CLAUDE.md).
async function notifyProjectPms(leadId: string | null, message: string, link: string) {
    if (leadId) await notifyLeadPms(leadId, message, "project", link);
    else await notifyAllAdmins(message, "project", link); // notifyAllAdmins notifies every manager
}

type Db = Pick<typeof db, "query">;

/** Why the project cannot be handed over yet (milestones, final payment, handover files), or null when ready. */
async function readinessError(tx: Db, projectId: string): Promise<string | null> {
    const projectMilestones = await tx.query.milestones.findMany({
        where: and(eq(milestones.projectId, projectId), isNull(milestones.deletedAt)),
        columns: { id: true, title: true, status: true },
    });
    if (projectMilestones.length === 0) return "Project has no milestones to complete.";
    const open = projectMilestones.find((m) => m.status !== "Completed");
    if (open) return `Milestone "${open.title}" is not Completed (status: ${open.status}).`;

    const projectPayments = await tx.query.payments.findMany({
        where: eq(payments.projectId, projectId),
        with: { scheduleItem: { columns: { sortOrder: true } } },
    });
    if (projectPayments.length === 0) return "Project has no payment records.";
    const finalPayment = [...projectPayments].sort(
        (a, b) => (b.scheduleItem?.sortOrder ?? 0) - (a.scheduleItem?.sortOrder ?? 0)
    )[0];
    if (finalPayment.status !== "paid") {
        return `Final payment "${finalPayment.label}" must be marked as paid before completion (current status: ${finalPayment.status}).`;
    }

    const handoverFiles = await tx.query.document.findMany({ where: eq(document.projectId, projectId), columns: { id: true } });
    if (handoverFiles.length === 0) return "At least one handover document must be uploaded first.";
    return null;
}

// Shared links the PM may attach instead of uploading a file. Hosts are listed one by one so nothing else slips through.
const SHARED_LINK_HOSTS = ["docs.google.com", "drive.google.com"];

/** An uploaded file of this project, or an https link on a Google Docs / Drive host. */
async function validateHandoverRef(projectId: string, url: string) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol === "https:" && SHARED_LINK_HOSTS.includes(parsed.hostname)) return { ok: true as const };
    } catch {
        // Not an absolute URL: it may be an uploaded file path, checked below.
    }
    return validateFileUrlForProject(projectId, url);
}

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

        const fileValidation = await validateHandoverRef(projectId, fileUrl);
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

            const fileValidation = await validateHandoverRef(projectId, signOffFileUrl);
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
    projectId: string,
    opts?: { assumedReason?: string }
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

            const notReady = await readinessError(tx, projectId);
            if (notReady) return { success: false, error: notReady };

            // 4. The client must have accepted, or the wait has passed and the PM gives a reason.
            const assumed = !project.acceptedAt && Boolean(opts?.assumedReason?.trim());
            if (!project.acceptedAt && (!assumed || !canAssumeAcceptance(project))) {
                return {
                    success: false,
                    error: `The client must accept the handover first. After ${ACCEPTANCE_WAIT_DAYS} days without an answer you can complete it with a reason.`,
                };
            }

            // 5. Execute completion with SQL computed timestamps
            const updatedRows = await tx
                .update(agencyProjects)
                .set({
                    status: "Completed",
                    ...(assumed ? { acceptanceAssumed: true, acceptanceAssumedReason: opts!.assumedReason!.trim() } : {}),
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


type Result = { success: boolean; error?: string; message?: string };

/** PM asks the client to review the handover. Allowed once milestones, final payment and handover files are in place. */
export async function requestClientAcceptance(projectId: string): Promise<Result> {
    const session = await auth();
    if (!session?.user?.id || !hasRole(session, ["manager"])) return { success: false, error: "Unauthorized: Managers only." };

    const project = await db.query.agencyProjects.findFirst({ where: eq(agencyProjects.id, projectId) });
    if (!project || project.isArchived) return { success: false, error: "Project not found or archived." };
    if (project.status === "Completed") return { success: false, error: "Project is already completed." };
    if (project.acceptedAt) return { success: false, error: "The client has already accepted." };
    if (acceptanceState(project) === "awaiting") return { success: false, error: "Acceptance was already requested." };

    const notReady = await readinessError(db, projectId);
    if (notReady) return { success: false, error: notReady };

    await db.update(agencyProjects).set({ acceptanceRequestedAt: new Date(), updatedAt: new Date() }).where(eq(agencyProjects.id, projectId));
    await logAction("UPDATE", "Project", `Requested client acceptance for "${project.title}"`, session.user.id, projectId);
    await notifyProjectClients(
        projectId,
        `Your project "${project.title}" is ready for your review. Please check the handover files and accept or request fixes.`,
        "project",
        `/portal/projects/${projectId}`
    );
    // Email too, so the client sees it outside the portal (user asked 2026-11-08).
    try {
        const details = await db.query.agencyProjects.findFirst({
            where: eq(agencyProjects.id, projectId),
            with: { lead: { with: { client: true } }, stakeholders: { with: { user: true } } },
        });
        const clientUser = details?.lead?.client || details?.stakeholders?.find((s) => s.user?.role === "client")?.user;
        const clientEmail = clientUser?.email || details?.lead?.contactEmail;
        if (clientEmail) {
            await sendHandoverReviewEmail({
                clientEmail,
                clientName: clientUser?.name || details?.lead?.contactName || "there",
                projectTitle: project.title,
                portalUrl: `${getBaseUrl()}/portal/projects/${projectId}`,
            });
        }
    } catch (err) {
        console.error("Handover review email failed:", err); // the request itself already succeeded
    }
    revalidatePath(`/dashboard/pm/${projectId}/complete`);
    revalidatePath(`/portal/projects/${projectId}`);
    return { success: true, message: "Acceptance requested. The client has been notified." };
}

async function clientProject(projectId: string) {
    const session = await auth();
    if (!session?.user?.id || !hasRole(session, ["client"])) return { error: "Unauthorized." as const };
    if (!(await getClientProjectIds(session.user.id)).includes(projectId)) return { error: "Unauthorized." as const };
    const project = await db.query.agencyProjects.findFirst({ where: eq(agencyProjects.id, projectId) });
    if (!project || project.isArchived) return { error: "Project not found." as const };
    if (acceptanceState(project) !== "awaiting") return { error: "There is nothing to accept right now." as const };
    return { session, project };
}

/** The client confirms the handover. Only the project's own client can do this. */
export async function acceptCompletion(projectId: string): Promise<Result> {
    const r = await clientProject(projectId);
    if ("error" in r) return { success: false, error: r.error };
    await db.update(agencyProjects).set({ acceptedAt: new Date(), acceptedBy: r.session.user.id, updatedAt: new Date() }).where(eq(agencyProjects.id, projectId));
    await logAction("UPDATE", "Project", `Client accepted the handover of "${r.project.title}"`, r.session.user.id, projectId);
    await notifyProjectPms(r.project.leadId, `The client accepted the handover of "${r.project.title}". You can now mark it complete.`, `/dashboard/pm/${projectId}/complete`);
    revalidatePath(`/dashboard/pm/${projectId}/complete`);
    revalidatePath(`/portal/projects/${projectId}`);
    return { success: true, message: "Thank you. You accepted the handover." };
}

/** The client asks for fixes instead. A comment is required; the PM can add files and request acceptance again. */
export async function requestCompletionFixes(projectId: string, comment: string): Promise<Result> {
    const text = (comment || "").trim();
    if (!text) return { success: false, error: "Please tell us what needs fixing." };
    if (text.length > 2000) return { success: false, error: "Comment is too long (max 2000 characters)." };
    const r = await clientProject(projectId);
    if ("error" in r) return { success: false, error: r.error };
    await db.update(agencyProjects).set({ fixesRequestedAt: new Date(), fixesComment: text, updatedAt: new Date() }).where(eq(agencyProjects.id, projectId));
    await logAction("UPDATE", "Project", `Client requested fixes on "${r.project.title}"`, r.session.user.id, projectId);
    await notifyProjectPms(r.project.leadId, `The client requested fixes on "${r.project.title}": ${text.slice(0, 120)}`, `/dashboard/pm/${projectId}/complete`);
    revalidatePath(`/dashboard/pm/${projectId}/complete`);
    revalidatePath(`/portal/projects/${projectId}`);
    return { success: true, message: "Your request was sent to the project manager." };
}
