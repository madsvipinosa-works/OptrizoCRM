"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { agencyProjects, leads, projectStakeholders } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAction } from "@/features/audit/actions";

export async function addClientLeadDocument(leadId: string, fileUrl: string) {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "client") {
        return { success: false, message: "Unauthorized" };
    }

    if (!leadId || !fileUrl) {
        return { success: false, message: "Missing upload parameters" };
    }

    // Security guardrail: only allow documents uploaded through our private upload pipeline.
    if (!fileUrl.startsWith("/api/private-file")) {
        return { success: false, message: "Invalid file reference" };
    }

    // Verify the client is a stakeholder for the project derived from this lead.
    const project = await db.query.agencyProjects.findFirst({
        where: eq(agencyProjects.leadId, leadId),
    });
    if (!project) {
        return { success: false, message: "Project not found for this lead" };
    }

    const isStakeholder = await db.query.projectStakeholders.findFirst({
        where: and(eq(projectStakeholders.projectId, project.id), eq(projectStakeholders.userId, session.user.id)),
    });

    if (!isStakeholder) {
        return { success: false, message: "Unauthorized: Not a stakeholder for this lead/project" };
    }

    const lead = await db.query.leads.findFirst({
        where: eq(leads.id, leadId),
    });
    if (!lead) {
        return { success: false, message: "Lead not found" };
    }

    const currentFiles = lead.files ?? [];
    if (currentFiles.includes(fileUrl)) {
        return { success: true, message: "File already attached" };
    }

    const updatedFiles = [...currentFiles, fileUrl];

    await db.update(leads)
        .set({
            files: updatedFiles,
            updatedAt: new Date(),
        })
        .where(eq(leads.id, leadId));

    await logAction("CREATE", "Client Document", `Client attached document to Lead ${leadId}`);

    revalidatePath("/portal");
    return { success: true, message: "Document uploaded to your portal." };
}

