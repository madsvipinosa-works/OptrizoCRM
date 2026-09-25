"use server";

import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { agencyProjects, leads, projectStakeholders, type ProjectDocumentItem } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAction } from "@/features/audit/actions";

export async function addClientLeadDocument(
    leadIdOrProjectId: string,
    fileUrl: string,
    projectIdParam?: string
) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "Unauthorized: Please log in." };
    }

    if (!leadIdOrProjectId || !fileUrl) {
        return { success: false, message: "Missing upload parameters." };
    }

    // Security guardrail: accept legitimate upload URLs (local or remote blob)
    if (!fileUrl.startsWith("/uploads/") && !fileUrl.startsWith("https://")) {
        return { success: false, message: "Invalid file reference." };
    }

    // 1. Locate the project by ID directly or via leadId
    let project = projectIdParam
        ? await db.query.agencyProjects.findFirst({
            where: eq(agencyProjects.id, projectIdParam),
        })
        : await db.query.agencyProjects.findFirst({
            where: eq(agencyProjects.id, leadIdOrProjectId),
        });

    if (!project) {
        project = await db.query.agencyProjects.findFirst({
            where: eq(agencyProjects.leadId, leadIdOrProjectId),
        });
    }

    if (!project) {
        return { success: false, message: "Project not found for this document." };
    }

    // 2. Multi-tier Authorization
    const isStaff = hasRole(session, ["superadmin", "manager", "sales", "developer", "content_editor"]);

    if (!isStaff) {
        // Stakeholder check
        const isStakeholder = await db.query.projectStakeholders.findFirst({
            where: and(
                eq(projectStakeholders.projectId, project.id),
                eq(projectStakeholders.userId, session.user.id)
            ),
        });

        // Lead ownership check
        let isLeadClient = false;
        if (project.leadId) {
            const leadRecord = await db.query.leads.findFirst({
                where: and(
                    eq(leads.id, project.leadId),
                    eq(leads.clientId, session.user.id)
                ),
            });
            if (leadRecord) isLeadClient = true;
        }

        if (!isStakeholder && !isLeadClient) {
            return { success: false, message: "Unauthorized: Not authorized for this project's documents." };
        }

        // Auto-link client as stakeholder if lead owner
        if (!isStakeholder && isLeadClient) {
            try {
                await db.insert(projectStakeholders).values({
                    projectId: project.id,
                    userId: session.user.id,
                }).onConflictDoNothing();
            } catch (linkErr) {
                console.warn("[ClientPortal] Stakeholder link skipped:", linkErr);
            }
        }
    }

    // 3. Resolve document type from file extension
    const ext = fileUrl.split('.').pop()?.toLowerCase() || "";
    let docType: "pdf" | "doc" | "sheet" | "figma" | "link" = "doc";
    if (ext === "pdf") {
        docType = "pdf";
    } else if (["xls", "xlsx", "csv"].includes(ext)) {
        docType = "sheet";
    } else if (["fig", "figma"].includes(ext)) {
        docType = "figma";
    }

    // Clean up filename for display
    const rawFileName = fileUrl.split('/').pop() || "Client Document";
    const cleanFileName = decodeURIComponent(
        rawFileName.replace(/^[a-f0-9-]+_/, "").replace(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-/, "")
    );

    const newDoc: ProjectDocumentItem = {
        id: crypto.randomUUID(),
        title: cleanFileName,
        url: fileUrl,
        type: docType,
        sizeBytes: 0, // Will be updated if possible, or left 0 for links
        uploadedById: session.user.id,
        uploadedByName: session.user.name || "Client",
        uploadedByRole: isStaff ? "agency" : "client",
        createdAt: new Date().toISOString()
    };

    const { sql } = await import("drizzle-orm");
    await db.update(agencyProjects)
        .set({
            documents: sql`COALESCE(${agencyProjects.documents}, '[]'::jsonb) || ${JSON.stringify([newDoc])}::jsonb`,
            updatedAt: new Date()
        })
        .where(eq(agencyProjects.id, project.id));

    await logAction(
        "CREATE",
        "Client Document",
        `Attached document '${cleanFileName}' to Project ${project.title}`,
        session.user.id
    );

    if (!isStaff) {
        const { notifyAllAdmins } = await import("@/features/notifications/actions");
        await notifyAllAdmins(
            `Client uploaded resource '${cleanFileName}' to ${project.title}`,
            "document",
            `/dashboard/pm/${project.id}`
        );
    } else {
        const { notifyProjectClients } = await import("@/features/notifications/actions");
        await notifyProjectClients(
            project.id,
            `New Resource Uploaded: The team uploaded "${cleanFileName}" to your project resources.`,
            "document",
            "/portal"
        );
    }

    revalidatePath("/portal");
    revalidatePath(`/dashboard/pm/${project.id}`);
    revalidatePath("/dashboard/pm");

    return { success: true, message: "Document uploaded and attached successfully." };
}

