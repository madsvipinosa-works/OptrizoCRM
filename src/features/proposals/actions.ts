"use server";

import { db } from "@/db";
import { proposals, leads, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth, hasRole } from "@/auth";
import { revalidatePath } from "next/cache";
import { notifyAllAdmins } from "@/features/notifications/actions";
import { markLeadAsWon } from "@/features/crm/actions";
import { logAction } from "@/features/audit/actions";

export interface ProposalData {
    proposalCode?: string;
    scope?: string;
    deliverables?: any;
    timeline?: string;
    technicalApproach?: string;
    pricingStructure?: any;
    subtotal?: number;
    discount?: number;
    tax?: number;
    total?: number;
    terms?: string;
    validUntil?: Date | string | null;
    fileUrl?: string | null;
}

export async function createProposal(leadId: string, data: ProposalData) {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const proposalCode = data.proposalCode || `OPT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const [newProposal] = await db.insert(proposals).values({
            leadId,
            ...data,
            proposalCode,
            validUntil: data.validUntil ? new Date(data.validUntil) : null,
            status: "Draft",
        }).returning();

        await logAction("CREATE", "Proposal", `Draft proposal generated for Lead ${leadId} (${proposalCode})`);

        revalidatePath(`/dashboard/leads/${leadId}`);
        revalidatePath(`/dashboard/proposals/builder/${newProposal.id}`);
        return { success: true, proposal: newProposal };
    } catch (error) {
        console.error("Failed to create proposal:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function updateProposal(id: string, data: ProposalData, status?: "Draft" | "Sent" | "Approved" | "Rejected") {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const oldProposal = await db.query.proposals.findFirst({ where: eq(proposals.id, id) });
        if (!oldProposal) return { success: false, message: "Proposal not found" };

        const updatePayload: any = { ...data, updatedAt: new Date() };
        if (status) {
            updatePayload.status = status;
        }
        if (data.validUntil !== undefined) {
            updatePayload.validUntil = data.validUntil ? new Date(data.validUntil) : null;
        }

        const [updated] = await db.update(proposals)
            .set(updatePayload)
            .where(eq(proposals.id, id))
            .returning();

        revalidatePath(`/dashboard/leads/${updated.leadId}`);
        revalidatePath(`/dashboard/proposals/builder/${id}`);
        revalidatePath(`/proposal/${id}`);
        
        if (status === "Sent") {
             await db.update(leads).set({ status: "Proposal Sent" }).where(eq(leads.id, updated.leadId));
        }
        
        // Custom Audit Log Logic for Scope & Pricing
        let auditMsg = `Proposal ${id} updated (Status: ${status || updated.status})`;
        if (data.total !== undefined && data.total !== oldProposal.total) {
            auditMsg += ` | Total updated to $${data.total}`;
        }
        if (data.scope && data.scope !== oldProposal.scope) {
            auditMsg += ` | Scope changed`;
        }
        
        await logAction("UPDATE", "Proposal", auditMsg);
        
        return { success: true, proposal: updated };
    } catch (error) {
        console.error("Failed to update proposal:", error);
        return { success: false, message: "Database Error" };
    }
}

export interface ProposalAcceptancePayload {
    acceptedByName: string;
    acceptedByTitle?: string;
    signatureData?: string;
}

export async function acceptProposalByClient(id: string, payload?: ProposalAcceptancePayload) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, message: "Unauthorized: Please log in to accept proposal" };
        }

        const proposal = await db.query.proposals.findFirst({
            where: eq(proposals.id, id),
            with: { lead: true }
        });

        if (!proposal) return { success: false, message: "Proposal not found" };
        if (!proposal.lead) return { success: false, message: "Proposal lead missing" };

        const isLeadOwner = session.user.id === proposal.lead.clientId;
        const isStaff = hasRole(session, ["superadmin", "sales", "manager"]);

        // Ownership: client can only accept proposals linked to their lead (or staff test)
        if (!isLeadOwner && !isStaff) {
            return { success: false, message: "Unauthorized: Proposal ownership mismatch" };
        }

        if (proposal.status === "Approved") return { success: false, message: "Proposal has already been approved" };

        const signerName = payload?.acceptedByName || session.user.name || "Authorized Client";
        const signerTitle = payload?.acceptedByTitle || "Client Representative";
        const signature = payload?.signatureData || signerName;
        const acceptedAt = new Date();

        // Execute atomic status update with full digital signature audit trail
        await db.update(proposals)
            .set({ 
                status: "Approved", 
                acceptedByName: signerName,
                acceptedByEmail: session.user.email,
                acceptedByTitle: signerTitle,
                signatureData: signature,
                acceptedAt,
                updatedAt: new Date() 
            })
            .where(eq(proposals.id, id));

        // Trigger Won Automation internally (provisions Project, Stakeholder, Milestones, Client Welcome Email)
        const wonResult = await markLeadAsWon(proposal.leadId, true);
        if (!wonResult.success) {
            console.error("markLeadAsWon failed during proposal acceptance:", wonResult.message);
        }
        
        if (proposal.lead) {
            await notifyAllAdmins(`Proposal accepted and signed by ${signerName} (${proposal.lead.businessName || "Client"})!`, "proposal", `/dashboard/leads`);
        }
        
        await logAction("UPDATE", "Proposal", `Proposal ${proposal.proposalCode || id} executed and signed by ${signerName} (${signerTitle})`);
        
        // Instant UI cache updates across all client & staff views
        revalidatePath(`/proposal/${id}`);
        revalidatePath("/dashboard/leads");
        revalidatePath(`/dashboard/leads/${proposal.leadId}`);
        revalidatePath("/portal/projects");
        revalidatePath("/dashboard/pm");
        
        return { success: true, message: "Proposal accepted and legally executed! Project board has been provisioned." };
    } catch (error) {
        console.error("Failed to accept proposal:", error);
        return { success: false, message: "System error while accepting proposal." };
    }
}

export async function rejectProposalByClient(id: string, reason?: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, message: "Unauthorized" };
        }

        const proposal = await db.query.proposals.findFirst({
            where: eq(proposals.id, id),
            with: { lead: true }
        });

        if (!proposal) return { success: false, message: "Proposal not found" };
        if (!proposal.lead) return { success: false, message: "Proposal lead missing" };

        // Ownership: client can only reject proposals linked to their lead.
        if (session.user.id !== proposal.lead.clientId) {
            return { success: false, message: "Unauthorized: Proposal ownership mismatch" };
        }

        if (proposal.status === "Rejected") return { success: false, message: "Already rejected" };

        await db.update(proposals)
            .set({ 
                status: "Rejected", 
                rejectionReason: reason || null, 
                updatedAt: new Date() 
            })
            .where(eq(proposals.id, id));

        // Sync proposal rejection back to the Lead status ("In Review")
        await db.update(leads).set({ status: "In Review", updatedAt: new Date() }).where(eq(leads.id, proposal.leadId));

        if (proposal.lead) {
            await notifyAllAdmins(`Proposal rejected by ${proposal.lead.businessName || "Client"}! ${reason ? 'Reason: ' + reason : ''}`, "proposal", `/dashboard/leads`);
        }
        
        await logAction("UPDATE", "Proposal", `Proposal ${id} rejected by client. Reason: ${reason || 'N/A'}`);
        
        revalidatePath(`/proposal/${id}`);
        revalidatePath("/dashboard/leads");
        revalidatePath(`/dashboard/leads/${proposal.leadId}`);
        
        return { success: true, message: "Proposal rejected." };
    } catch (error) {
        console.error("Failed to reject proposal:", error);
        return { success: false, message: "System error while rejecting proposal." };
    }
}

import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendProposalEmail(proposalId: string) {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    const p = await db.query.proposals.findFirst({
        where: eq(proposals.id, proposalId),
        with: { lead: { with: { client: true } } }
    });
    
    if (!p || !p.lead || !p.lead.client) return { success: false, message: "Proposal, lead, or client not found" };

    try {
        const url = `${process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL : 'http://localhost:3000')}/proposal/${proposalId}`;
        
        await resend.emails.send({
            from: "Optrizo <onboarding@resend.dev>",
            to: p.lead.client.email,
            subject: `Your Custom Proposal from Optrizo - ${p.lead.businessName || p.lead.client.name}`,
            html: `<p>Hi ${p.lead.client.name},</p><p>We have prepared a custom proposal for your project.</p><p>You can view and accept it here: <br/><a href="${url}">${url}</a></p><p>Looking forward to working with you!</p><p>The Optrizo Team</p>`,
        });

        // Mark as sent
        await updateProposal(proposalId, {}, "Sent");

        return { success: true };
    } catch(e) {
        console.error(e);
        return { success: false, message: "Failed to send email." };
    }
}

export async function getProposalById(id: string) {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales", "manager", "developer", "content_editor"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const proposal = await db.query.proposals.findFirst({
            where: eq(proposals.id, id),
            with: {
                lead: {
                    with: {
                        client: true,
                    },
                },
            },
        });
        if (!proposal) return { success: false, message: "Proposal not found" };
        return { success: true, proposal };
    } catch (error) {
        console.error("Failed to fetch proposal:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function deleteProposal(id: string) {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const proposal = await db.query.proposals.findFirst({ where: eq(proposals.id, id) });
        if (!proposal) return { success: false, message: "Proposal not found" };

        if (proposal.status === "Approved") {
            return { success: false, message: "Cannot delete an approved/accepted proposal" };
        }

        await db.delete(proposals).where(eq(proposals.id, id));
        await logAction("DELETE", "Proposal", `Proposal ${id} deleted`);
        
        revalidatePath(`/dashboard/leads/${proposal.leadId}`);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete proposal:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function getOrCreateDraftProposal(leadId: string) {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales", "manager", "developer", "content_editor"])) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        // Look for existing draft or active proposal
        const existing = await db.query.proposals.findFirst({
            where: eq(proposals.leadId, leadId),
            orderBy: (p, { desc }) => [desc(p.createdAt)],
        });

        if (existing) {
            return { success: true, proposalId: existing.id };
        }

        // Fetch lead goals and business name to pre-populate
        const lead = await db.query.leads.findFirst({
            where: eq(leads.id, leadId),
        });

        const proposalCode = `OPT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const [newProposal] = await db.insert(proposals).values({
            leadId,
            proposalCode,
            scope: lead?.goals || "Comprehensive digital solution and strategic implementation.",
            deliverables: [
                "Technical Architecture & Requirements Document",
                "UI/UX Design System & Interactive Prototypes",
                "Full-Stack Application Development",
                "Quality Assurance, Performance & Security Audit",
            ],
            timeline: "4 - 6 Weeks",
            pricingStructure: [
                { name: "Discovery, Strategy & UX Design", description: "Wireframes and user flows", quantity: 1, unitPrice: 2000, total: 2000 },
                { name: "Engineering & Cloud Architecture", description: "Full-stack implementation", quantity: 1, unitPrice: 5000, total: 5000 },
            ],
            subtotal: 7000,
            discount: 0,
            tax: 0,
            total: 7000,
            terms: "Standard Agency Terms: 50% deposit required upon acceptance, 50% balance due upon project delivery.",
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: "Draft",
        }).returning();

        await logAction("CREATE", "Proposal", `Initialized draft proposal ${proposalCode} for Lead ${leadId}`);

        revalidatePath(`/dashboard/leads/${leadId}`);
        return { success: true, proposalId: newProposal.id };
    } catch (error) {
        console.error("Failed to initialize draft proposal:", error);
        return { success: false, message: "Database Error" };
    }
}
