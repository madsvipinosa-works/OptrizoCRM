"use server";

import { db } from "@/db";
import { agencyProjects, projectStakeholders, type ProjectDocumentItem } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAction } from "@/features/audit/log";
import { authorizeProject, requireSession } from "@/lib/authz";

export async function addClientLeadDocument(
    leadIdOrProjectId: string,
    fileUrl: string,
    projectIdParam?: string
) {
    const signedIn = await requireSession();
    if (!signedIn.ok) {
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

    // A missing project and a project the caller may not use get the same answer, so IDs can't be probed.
    const denied = { success: false, message: "Project not found or you do not have access to it." };
    if (!project) return denied;

    // 2. Authorization: the PM, or the client who owns the project. Nobody else may attach documents.
    const access = await authorizeProject(project.id, "write");
    if (!access.ok) return denied;
    const { session } = access;
    const isClient = session.user.role === "client";

    // Auto-link a client who owns the originating lead as a project stakeholder (a no-op if already linked)
    if (isClient) {
        try {
            await db.insert(projectStakeholders).values({
                projectId: project.id,
                userId: session.user.id,
            }).onConflictDoNothing();
        } catch (linkErr) {
            console.warn("[ClientPortal] Stakeholder link skipped:", linkErr);
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
        uploadedByRole: isClient ? "client" : "agency",
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

    if (isClient) {
        const { notifyAllAdmins } = await import("@/features/notifications/send");
        await notifyAllAdmins(
            `Client uploaded resource '${cleanFileName}' to ${project.title}`,
            "document",
            `/dashboard/pm/${project.id}`
        );
    } else {
        const { notifyProjectClients } = await import("@/features/notifications/send");
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
