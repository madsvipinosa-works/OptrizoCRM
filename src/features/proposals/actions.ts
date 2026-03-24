"use server";

import { db } from "@/db";
import { proposals, leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { notifyAllAdmins } from "@/features/notifications/actions";
import { markLeadAsWon } from "@/features/crm/actions";

export interface ProposalData {
    scope?: string;
    deliverables?: string;
    timeline?: string;
    technicalApproach?: string;
    pricingStructure?: string;
    fileUrl?: string;
}

export async function createProposal(leadId: string, data: ProposalData) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const [newProposal] = await db.insert(proposals).values({
            leadId,
            ...data,
            status: "Draft",
        }).returning();

        revalidatePath(`/dashboard/leads/${leadId}`);
        return { success: true, proposal: newProposal };
    } catch (error) {
        console.error("Failed to create proposal:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function updateProposal(id: string, data: ProposalData, status?: "Draft" | "Sent" | "Approved" | "Rejected") {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const [updated] = await db.update(proposals)
            .set({ ...data, ...(status && { status }), updatedAt: new Date() })
            .where(eq(proposals.id, id))
            .returning();

        if (!updated) return { success: false, message: "Proposal not found" };

        revalidatePath(`/dashboard/leads/${updated.leadId}`);
        revalidatePath(`/proposal/${id}`);
        
        if (status === "Sent") {
             await db.update(leads).set({ status: "Proposal Sent" }).where(eq(leads.id, updated.leadId));
        }
        
        return { success: true, proposal: updated };
    } catch (error) {
        console.error("Failed to update proposal:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function acceptProposalByClient(id: string) {
    try {
        const proposal = await db.query.proposals.findFirst({
            where: eq(proposals.id, id),
            with: { lead: true }
        });

        if (!proposal) return { success: false, message: "Proposal not found" };
        if (proposal.status === "Approved") return { success: false, message: "Already approved" };

        await db.update(proposals).set({ status: "Approved", updatedAt: new Date() }).where(eq(proposals.id, id));

        // Trigger Won Automation
        const result = await markLeadAsWon(proposal.leadId);
        
        if (proposal.lead) {
             await notifyAllAdmins(`Proposal accepted by ${proposal.lead.name}!`, "proposal", `/dashboard/leads/${proposal.lead.id}`);
        }
        
        revalidatePath(`/proposal/${id}`);
        
        return { success: true, message: "Proposal accepted! Project is being provisioned." };
    } catch (error) {
        console.error("Failed to accept proposal:", error);
        return { success: false, message: "System error while accepting proposal." };
    }
}
