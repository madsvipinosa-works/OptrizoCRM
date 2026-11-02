"use server";

import { db } from "@/db";
import {
    proposals,
    proposalMilestones,
    paymentScheduleItems,
    leads,
    users,
    discoveryForms,
} from "@/db/schema";
import { eq, and, isNull, isNotNull, ne, inArray } from "drizzle-orm";
import { moveLeadToProposalSent } from "@/features/crm/stage-rules";
import { auth, hasRole } from "@/auth";
import { requireRole } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { notifyAllAdmins } from "@/features/notifications/send";
import { provisionLeadProject } from "@/features/crm/provisionLeadProject";
import { logAction } from "@/features/audit/log";
import { ProposalLineItemSchema, SaveProposalSchema } from "@/lib/schemas";

export interface ContractSettings {
    clientAddress?: string;
    clientPhone?: string;
    clientContactPerson?: string;
    agencyAddress?: string;
    agencyPhone?: string;
    agencyRegistration?: string;
    governingLaw?: string;
    paymentMethod?: string;
    includeConfidentiality?: boolean;
    includeIpClause?: boolean;
    includeLiabilityClause?: boolean;
    includeForceClause?: boolean;
    includeChangeOrder?: boolean;
    includeDisputeResolution?: boolean;
    customClauses?: string;
    // Client required fields upon acceptance
    requireClientAddressOnAccept?: boolean;
    requireClientPhoneOnAccept?: boolean;
    requireClientTaxIdOnAccept?: boolean;
    clientTaxId?: string;
}

export interface ProposalData {
    proposalCode?: string;
    scope?: string;
    deliverables?: unknown;
    timeline?: string;
    technicalApproach?: string;
    pricingStructure?: unknown;
    subtotal?: number;
    discount?: number;
    tax?: number;
    total?: number;
    terms?: string;
    validUntil?: Date | string | null;
    fileUrl?: string | null;
    contractSettings?: ContractSettings;
    priceMode?: "to_be_discussed" | "priced";
    currency?: "PHP" | "USD";
    totalPrice?: number | null;
    needsGoals?: string | { needs: string; goals: string } | null;
}

export async function createDraftProposalForLead(leadId: string) {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can generate proposals" };
    }

    try {
        let createdProposalId = "";

        await db.transaction(async (tx) => {
            const lead = await tx.query.leads.findFirst({
                where: eq(leads.id, leadId),
            });

            if (!lead) {
                throw new Error("Lead not found");
            }

            // Check existing proposals for this lead
            const existingProposals = await tx.query.proposals.findMany({
                where: eq(proposals.leadId, leadId),
                orderBy: (p, { desc }) => [desc(p.version), desc(p.createdAt)],
            });

            if (existingProposals.length > 0) {
                const activeDraft = existingProposals.find((p) => p.status === "draft");
                if (activeDraft) {
                    createdProposalId = activeDraft.id;
                    return;
                }
                throw new Error("A proposal already exists for this lead. Use createProposalRevision to create a new version.");
            }

            // Rule: a v1 may be created only when lead has no proposal, proposalRequestedAt is set and lead is in "Discovery & Qualifying"
            if (lead.status !== "Discovery & Qualifying") {
                throw new Error(`Cannot create draft proposal: lead must be in "Discovery & Qualifying" (currently "${lead.status}").`);
            }

            if (!lead.proposalRequestedAt) {
                throw new Error("Cannot create draft proposal: proposal request has not been submitted for this lead.");
            }

            // Read discovery form
            const df = await tx.query.discoveryForms.findFirst({
                where: eq(discoveryForms.leadId, leadId),
                orderBy: (d, { desc }) => [desc(d.createdAt)],
            });

            const needsGoals = {
                needs: df?.requiredFeatures || "",
                goals: df?.goals || "",
            };

            const priceMode: "priced" | "to_be_discussed" =
                lead.clientType === "international" ? "priced" : "to_be_discussed";

            const proposalCode = `OPT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

            const [newProposal] = await tx.insert(proposals).values({
                leadId: lead.id,
                proposalCode,
                version: 1,
                scope: lead.goals || `Strategic agency implementation and digital transformation for ${lead.businessName || "Client"}.`,
                timeline: lead.timelineExpectation || "4-6 Weeks from project kickoff",
                deliverables: [
                    "Technical Architecture & Requirements Document",
                    "UI/UX Design System & Interactive Prototypes",
                    "Full-Stack Application Development",
                    "Quality Assurance, Performance & Security Audit",
                ],
                priceMode,
                currency: "PHP",
                totalPrice: null,
                needsGoals,
                terms: "Standard Agency Terms: Commercial terms and payment schedule to be finalized upon project alignment.",
                validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: "draft",
            }).returning();

            createdProposalId = newProposal.id;

            // Insert 5 default milestones with null dates
            const defaultMilestoneNames: Array<"requirements" | "design" | "development" | "uat_testing" | "handover"> = [
                "requirements",
                "design",
                "development",
                "uat_testing",
                "handover",
            ];

            await tx.insert(proposalMilestones).values(
                defaultMilestoneNames.map((name) => ({
                    id: crypto.randomUUID(),
                    proposalId: newProposal.id,
                    name,
                    startDate: null,
                    endDate: null,
                }))
            );

            // Insert default 30/30/40 payment schedule
            await tx.insert(paymentScheduleItems).values([
                {
                    id: crypto.randomUUID(),
                    proposalId: newProposal.id,
                    label: "On signing",
                    percent: 30,
                    trigger: "on_signing" as const,
                    sortOrder: 0,
                },
                {
                    id: crypto.randomUUID(),
                    proposalId: newProposal.id,
                    label: "After design approval",
                    percent: 30,
                    trigger: "design" as const,
                    sortOrder: 1,
                },
                {
                    id: crypto.randomUUID(),
                    proposalId: newProposal.id,
                    label: "On handover",
                    percent: 40,
                    trigger: "handover" as const,
                    sortOrder: 2,
                },
            ]);
        });

        await logAction("CREATE", "Proposal", `Draft proposal generated for Lead ${leadId}`);

        revalidatePath(`/dashboard/leads/${leadId}`);
        revalidatePath(`/dashboard/leads`);
        revalidatePath(`/dashboard/proposals`);
        revalidatePath(`/dashboard/proposals/builder/${createdProposalId}`);

        return { success: true, proposalId: createdProposalId };
    } catch (error) {
        // Concurrency: catch unique-violation on (leadId, version) and return existing draft
        if (error && typeof error === "object" && (("code" in error && error.code === "23505") || String(error).includes("idx_proposal_lead_version"))) {
            const existingDraft = await db.query.proposals.findFirst({
                where: and(eq(proposals.leadId, leadId), eq(proposals.status, "draft")),
            });
            if (existingDraft) {
                return { success: true, proposalId: existingDraft.id };
            }
        }
        console.error("Failed to generate draft proposal for lead:", error);
        return { success: false, message: error instanceof Error ? error.message : "Database Error" };
    }
}

export async function createProposal(leadId: string, data: ProposalData) {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can create proposals" };
    }

    const validated = SaveProposalSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, message: validated.error.issues[0]?.message || "Validation Error" };
    }

    try {
        const proposalCode = data.proposalCode || `OPT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const formattedNeedsGoals = typeof data.needsGoals === "string"
            ? { needs: data.needsGoals, goals: "" }
            : data.needsGoals ?? null;

        const [newProposal] = await db.insert(proposals).values({
            ...data,
            leadId,
            needsGoals: formattedNeedsGoals,
            proposalCode,
            validUntil: data.validUntil ? new Date(data.validUntil) : null,
            status: "draft",
        }).returning();

        // Auto-sync contract value to Lead estimatedValue if total is provided
        if (data.total !== undefined && Number(data.total) > 0) {
            await db.update(leads)
                .set({ estimatedValue: Math.round(Number(data.total)), updatedAt: new Date() })
                .where(eq(leads.id, leadId));
        }

        await logAction("CREATE", "Proposal", `Draft proposal generated for Lead ${leadId} (${proposalCode})`);

        revalidatePath(`/dashboard/leads/${leadId}`);
        revalidatePath(`/dashboard/leads`);
        revalidatePath(`/dashboard/analytics`);
        revalidatePath(`/dashboard/proposals/builder/${newProposal.id}`);
        return { success: true, proposal: newProposal };
    } catch (error) {
        console.error("Failed to create proposal:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function updateProposal(id: string, data: ProposalData, _deprecatedStatus?: string) {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can update proposals" };
    }

    const validated = SaveProposalSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, message: validated.error.issues[0]?.message || "Validation Error" };
    }

    try {
        const oldProposal = await db.query.proposals.findFirst({ where: eq(proposals.id, id) });
        if (!oldProposal) return { success: false, message: "Proposal not found" };

        const updatePayload: any = { ...data, updatedAt: new Date() };
        if (false as boolean) {
            updatePayload.status = status;
        }
        if (data.validUntil !== undefined) {
            updatePayload.validUntil = data.validUntil ? new Date(data.validUntil) : null;
        }

        const [updated] = await db.update(proposals)
            .set(updatePayload)
            .where(eq(proposals.id, id))
            .returning();

        // Auto-sync contract value to Lead estimatedValue whenever total is modified
        if (data.total !== undefined && Number(data.total) >= 0) {
            await db.update(leads)
                .set({ estimatedValue: Math.round(Number(data.total)), updatedAt: new Date() })
                .where(eq(leads.id, updated.leadId));
        }

        revalidatePath(`/dashboard/leads`);
        revalidatePath(`/dashboard/leads/${updated.leadId}`);
        revalidatePath(`/dashboard/analytics`);
        revalidatePath(`/dashboard/proposals/builder/${id}`);
        revalidatePath(`/proposal/${id}`);

        if (false as boolean) {
            const { transitionLeadStage } = await import("@/features/crm/actions");
            await transitionLeadStage({ leadId: updated.leadId, newStatus: "Proposal Sent" });

            const { notifyLeadClient } = await import("@/features/notifications/send");
            await notifyLeadClient(
                updated.leadId,
                `Your Project Proposal (${updated.proposalCode || 'Agreement'}) has been published and is ready for your digital signature.`,
                "proposal",
                `/proposal/${id}`
            );
        } else if (oldProposal.status === "sent" && (data.total !== undefined || data.scope || data.deliverables)) {
            const { notifyLeadClient } = await import("@/features/notifications/send");
            await notifyLeadClient(
                updated.leadId,
                `Proposal Revisions: Updated terms and scope have been published for your project proposal.`,
                "proposal",
                `/proposal/${id}`
            );
        }

        // Custom Audit Log Logic for Scope & Pricing
        let auditMsg = `Proposal ${id} updated (Status: ${updated.status})`;
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
    clientAddress?: string;
    clientPhone?: string;
    clientTaxId?: string;
}

export async function acceptProposalByClient(id: string, payload?: ProposalAcceptancePayload) {
    try {

        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, message: "Unauthorized: Please log in to accept proposal" };
        }

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
        if (!proposal.lead) return { success: false, message: "Proposal lead missing" };

        const userRole = (session.user as any)?.role;
        const isLeadOwner =
            proposal.lead &&
            (session.user.id === proposal.lead.clientId ||
                session.user.email === proposal.lead.client?.email ||
                session.user.email === proposal.lead.contactEmail);

        // Strict RBAC: Administrators and internal staff are blocked from signing on behalf of clients.
        if (userRole !== "client") {
            return {
                success: false,
                message: "Forbidden: Administrators and internal staff cannot sign proposals on behalf of clients. Proposal acceptance must be completed by the authorized client organization.",
            };
        }

        // Ownership check: client can only accept proposals linked to their lead
        if (!isLeadOwner) {
            return { success: false, message: "Forbidden: You do not own this proposal" };
        }

        if (proposal.status === "signed") return { success: false, message: "Proposal has already been signed" };

        const signerName = payload?.acceptedByName || session.user.name || "Authorized Client";
        const signerTitle = payload?.acceptedByTitle || "Client Representative";
        const signature = payload?.signatureData || signerName;
        const acceptedAt = new Date();

        const oldContractSettings = (proposal.contractSettings as ContractSettings) || {};
        const updatedContractSettings = { ...oldContractSettings };
        if (payload?.clientAddress) updatedContractSettings.clientAddress = payload.clientAddress;
        if (payload?.clientPhone) updatedContractSettings.clientPhone = payload.clientPhone;
        if (payload?.clientTaxId) updatedContractSettings.clientTaxId = payload.clientTaxId;

        // Execute atomic status update with full digital signature audit trail
        await db.update(proposals)
            .set({
                status: "signed",
                acceptedByName: signerName,
                acceptedByEmail: session.user.email,
                acceptedByTitle: signerTitle,
                signatureData: signature,
                contractSettings: updatedContractSettings,
                acceptedAt,
                updatedAt: new Date()
            })
            .where(eq(proposals.id, id));

        // Ensure lead's estimatedValue matches final accepted proposal total
        if (proposal.total !== null && proposal.total !== undefined && proposal.total > 0) {
            await db.update(leads)
                .set({ estimatedValue: proposal.total, updatedAt: new Date() })
                .where(eq(leads.id, proposal.leadId));
        }

        // Trigger Won Automation internally (provisions Project, Stakeholder, Milestones, Client Welcome Email)
        const wonResult = await provisionLeadProject(proposal.leadId);
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
        revalidatePath("/dashboard/analytics");
        revalidatePath("/portal/projects");
        revalidatePath("/dashboard/pm");

        return { success: true, message: "Proposal accepted and authorized! Project board has been provisioned." };
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
            with: {
                lead: {
                    with: {
                        client: true,
                    },
                },
            },
        });

        if (!proposal) return { success: false, message: "Proposal not found" };
        if (!proposal.lead) return { success: false, message: "Proposal lead missing" };

        const userRole = (session.user as any)?.role;
        const isLeadOwner =
            proposal.lead &&
            (session.user.id === proposal.lead.clientId ||
                session.user.email === proposal.lead.client?.email ||
                session.user.email === proposal.lead.contactEmail);

        // Ownership: client can only reject proposals linked to their lead
        if (userRole !== "client" || !isLeadOwner) {
            return { success: false, message: "Forbidden: You do not own this proposal" };
        }

        if (proposal.status === "declined") return { success: false, message: "Already declined" };

        await db.update(proposals)
            .set({
                status: "declined",
                rejectionReason: reason || null,
                updatedAt: new Date()
            })
            .where(eq(proposals.id, id));

        // Sync proposal rejection back to the Lead status ("In Negotiation")
        await db.update(leads).set({ status: "In Negotiation", updatedAt: new Date() }).where(eq(leads.id, proposal.leadId));

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
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can send proposal emails" };
    }

    const p = await db.query.proposals.findFirst({
        where: eq(proposals.id, proposalId),
        with: { lead: { with: { client: true } } }
    });

    if (!p || !p.lead || !p.lead.client) return { success: false, message: "Proposal, lead, or client not found" };

    try {
        const url = `${process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : 'http://localhost:3000')}/proposal/${proposalId}`;

        await resend.emails.send({
            from: "Optrizo <onboarding@resend.dev>",
            to: p.lead.client.email,
            subject: `Your Custom Proposal from Optrizo - ${p.lead.businessName || p.lead.client.name}`,
            html: `<p>Hi ${p.lead.client.name},</p><p>We have prepared a custom proposal for your project.</p><p>You can view and accept it here: <br/><a href="${url}">${url}</a></p><p>Looking forward to working with you!</p><p>The Optrizo Team</p>`,
        });

        // Mark as sent
        await updateProposal(proposalId, {});

        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, message: "Failed to send email." };
    }
}

export async function getProposalById(id: string) {
    const authz = await requireRole(["sales", "manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Insufficient permissions to view proposals" };
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
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can delete proposals" };
    }

    try {
        const proposal = await db.query.proposals.findFirst({ where: eq(proposals.id, id) });
        if (!proposal) return { success: false, message: "Proposal not found" };

        if (proposal.status === "signed") {
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
    return createDraftProposalForLead(leadId);
}


export async function claimOrAssignLeadPm(leadId: string) {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can claim proposal requests" };
    }
    const { session } = authz;

    const lead = await db.query.leads.findFirst({
        where: eq(leads.id, leadId),
    });
    if (!lead) {
        return { success: false, message: "Lead not found" };
    }

    if (!lead.assignedPmId) {
        const res = await db.update(leads)
            .set({ assignedPmId: session.user.id, updatedAt: new Date() })
            .where(and(eq(leads.id, leadId), isNull(leads.assignedPmId)))
            .returning({ id: leads.id });

        if (res.length > 0) {
            await logAction("UPDATE", "Lead", `Lead ${leadId} assigned to PM ${session.user.name || session.user.id}`);
        }
    }

    revalidatePath("/dashboard/proposals");
    return { success: true, assignedPmId: lead.assignedPmId || session.user.id };
}


export async function getProposalRequestsQueue() {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return [];
    }

    const requests = await db.query.leads.findMany({
        where: and(
            isNotNull(leads.proposalRequestedAt),
            isNull(leads.archivedAt)
        ),
        with: {
            assignedPm: true,
            discoveryForms: {
                orderBy: (df, { desc }) => [desc(df.submittedAt)],
                limit: 1,
            },
            proposals: {
                where: isNull(proposals.deletedAt),
                orderBy: (p, { desc }) => [desc(p.updatedAt)],
            },
        },
        orderBy: (l, { desc }) => [desc(l.proposalRequestedAt)],
    });

    return requests.map((req) => ({
        id: req.id,
        businessName: req.businessName,
        contactName: req.contactName,
        contactEmail: req.contactEmail,
        contactPhone: req.contactPhone,
        urgency: req.urgency,
        proposalRequestedAt: req.proposalRequestedAt,
        assignedPmId: req.assignedPmId,
        assignedPm: req.assignedPm ? {
            id: req.assignedPm.id,
            name: req.assignedPm.name,
            email: req.assignedPm.email,
        } : null,
        discoveryForm: req.discoveryForms && req.discoveryForms[0] ? {
            goals: req.discoveryForms[0].goals,
            requiredFeatures: req.discoveryForms[0].requiredFeatures,
            targetTimeline: req.discoveryForms[0].targetTimeline,
            budgetRange: req.discoveryForms[0].budgetRange,
            clientType: req.discoveryForms[0].clientType,
            notes: req.discoveryForms[0].notes,
        } : null,
        proposals: req.proposals.map((p) => ({
            id: p.id,
            status: p.status,
            version: (p as unknown as { version?: number | null }).version ?? 1,
        })),
    }));
}

export async function resetProposalNeedsGoals(proposalId: string) {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can reset proposal needs and goals" };
    }

    try {
        const proposal = await db.query.proposals.findFirst({
            where: eq(proposals.id, proposalId),
            with: {
                lead: {
                    with: {
                        discoveryForms: {
                            orderBy: (df, { desc }) => [desc(df.submittedAt)],
                            limit: 1,
                        },
                    },
                },
            },
        });

        if (!proposal) return { success: false, message: "Proposal not found" };

        const df = proposal.lead?.discoveryForms?.[0];
        const resetObj = {
            needs: df?.requiredFeatures || "",
            goals: df?.goals || proposal.lead?.goals || "",
        };

        await db.update(proposals)
            .set({ needsGoals: resetObj, updatedAt: new Date() })
            .where(eq(proposals.id, proposalId));

        await logAction("UPDATE", "Proposal", `Reset needsGoals to discovery form for Proposal ${proposal.proposalCode || proposalId}`);
        revalidatePath(`/dashboard/proposals/builder/${proposalId}`);
        return { success: true, needsGoals: resetObj };
    } catch (error) {
        console.error("Failed to reset needs goals:", error);
        return { success: false, message: "Database Error" };
    }
}


const DEFAULT_PROPOSAL_MILESTONES = [
    { name: "requirements" as const, key: "requirements", title: "Requirements & Architecture", description: "Confirm features, user stories, acceptance criteria" },
    { name: "design" as const, key: "design", title: "UI/UX Design & Prototyping", description: "Wireframes and screen designs for approval" },
    { name: "development" as const, key: "development", title: "Full-Stack Development", description: "Built in two-week sprints with a demo after each" },
    { name: "uat_testing" as const, key: "uat_testing", title: "QA & UAT Testing", description: "Client tests on the agreed date; fixes before release" },
    { name: "handover" as const, key: "handover", title: "Final Handover & Deployment", description: "Deployment, training, source code, documentation" },
] as const;

export async function seedDefaultProposalMilestones(proposalId: string) {
    for (const m of DEFAULT_PROPOSAL_MILESTONES) {
        await db.insert(proposalMilestones).values({
            proposalId,
            name: m.name,
            startDate: null,
            endDate: null,
        }).onConflictDoNothing();
    }
}

export async function getProposalMilestones(proposalId: string) {
    const rows = await db.query.proposalMilestones.findMany({
        where: eq(proposalMilestones.proposalId, proposalId),
    });

    const map = new Map(rows.map((r) => [r.name, r]));
    return DEFAULT_PROPOSAL_MILESTONES.map((def) => {
        const found = map.get(def.name);
        return {
            id: found?.id || "",
            proposalId,
            name: def.name,
            key: def.key,
            title: def.title,
            description: def.description,
            startDate: found?.startDate ? new Date(found.startDate).toISOString().split("T")[0] : null,
            endDate: found?.endDate ? new Date(found.endDate).toISOString().split("T")[0] : null,
        };
    });
}

export async function updateProposalMilestones(
    proposalId: string,
    milestonesData: Array<{ name?: string; key?: string; startDate?: string | null; endDate?: string | null }>
) {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can update milestone dates" };
    }

    try {
        const proposal = await db.query.proposals.findFirst({
            where: eq(proposals.id, proposalId),
        });
        if (!proposal) return { success: false, message: "Proposal not found" };

        for (const item of milestonesData) {
            const mName = (item.name || item.key) as (typeof DEFAULT_PROPOSAL_MILESTONES)[number]["name"];
            const def = DEFAULT_PROPOSAL_MILESTONES.find((d) => d.name === mName || d.key === mName);
            if (!def) continue;

            const existing = await db.query.proposalMilestones.findFirst({
                where: and(
                    eq(proposalMilestones.proposalId, proposalId),
                    eq(proposalMilestones.name, def.name)
                ),
            });

            const sDate = item.startDate ? new Date(item.startDate) : null;
            const eDate = item.endDate ? new Date(item.endDate) : null;

            if (existing) {
                await db.update(proposalMilestones)
                    .set({
                        startDate: sDate,
                        endDate: eDate,
                        updatedAt: new Date(),
                    })
                    .where(eq(proposalMilestones.id, existing.id));
            } else {
                await db.insert(proposalMilestones).values({
                    proposalId,
                    name: def.name,
                    startDate: sDate,
                    endDate: eDate,
                });
            }
        }

        await logAction("UPDATE", "Proposal", `Updated milestone dates for proposal ${proposal.proposalCode || proposalId}`);
        revalidatePath(`/dashboard/proposals/builder/${proposalId}`);
        revalidatePath(`/dashboard/proposals/${proposalId}`);
        revalidatePath(`/proposal/${proposalId}`);

        const updated = await getProposalMilestones(proposalId);
        return { success: true, milestones: updated };
    } catch (error) {
        console.error("Failed to update milestone dates:", error);
        return { success: false, message: "Database Error" };
    }
}

export async function createProposalRevision(leadId: string) {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can create proposal revisions" };
    }

    try {
        const existingDraft = await db.query.proposals.findFirst({
            where: and(
                eq(proposals.leadId, leadId),
                eq(proposals.status, "draft"),
                isNull(proposals.deletedAt)
            ),
        });
        if (existingDraft) {
            return { success: false, message: "A draft proposal already exists for this lead", proposalId: existingDraft.id };
        }

        const latestProposal = await db.query.proposals.findFirst({
            where: and(
                eq(proposals.leadId, leadId),
                isNull(proposals.deletedAt)
            ),
            orderBy: (p, { desc }) => [desc(p.version), desc(p.createdAt)],
            with: {
                milestones: true,
                paymentScheduleItems: true,
            },
        });

        if (!latestProposal) {
            return { success: false, message: "No existing proposal found to revise" };
        }

        const allowedStatuses = ["sent", "pricing_meeting_requested", "changes_requested"];
        if (!allowedStatuses.includes(latestProposal.status)) {
            return {
                success: false,
                message: `Cannot create revision: latest proposal status is '${latestProposal.status}'. Must be sent, pricing_meeting_requested, or changes_requested.`
            };
        }

        const nextVersion = (latestProposal.version || 1) + 1;
        const proposalCode = latestProposal.proposalCode
            ? `${latestProposal.proposalCode.split("-v")[0]}-v${nextVersion}`
            : `OPT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}-v${nextVersion}`;

        const [revision] = await db.insert(proposals).values({
            leadId,
            proposalCode,
            version: nextVersion,
            status: "draft",
            priceMode: latestProposal.priceMode,
            currency: latestProposal.currency,
            totalPrice: latestProposal.totalPrice,
            needsGoals: latestProposal.needsGoals,
            scope: latestProposal.scope,
            deliverables: latestProposal.deliverables,
            timeline: latestProposal.timeline,
            technicalApproach: latestProposal.technicalApproach,
            terms: latestProposal.terms,
            validUntil: latestProposal.validUntil,
            contractSettings: latestProposal.contractSettings,
        }).returning();

        if (latestProposal.milestones && latestProposal.milestones.length > 0) {
            for (const m of latestProposal.milestones) {
                await db.insert(proposalMilestones).values({
                    proposalId: revision.id,
                    name: m.name,
                    startDate: m.startDate,
                    endDate: m.endDate,
                });
            }
        } else {
            await seedDefaultProposalMilestones(revision.id);
        }

        
        if (latestProposal.paymentScheduleItems && latestProposal.paymentScheduleItems.length > 0) {
            for (const item of latestProposal.paymentScheduleItems) {
                await db.insert(paymentScheduleItems).values({
                    proposalId: revision.id,
                    label: item.label,
                    percent: item.percent,
                    trigger: item.trigger,
                    sortOrder: item.sortOrder,
                });
            }
        } else {
            await seedDefaultPaymentSchedule(revision.id);
        }

        await logAction("CREATE", "Proposal", `Created proposal revision v${nextVersion} for Lead ${leadId}`);
        revalidatePath(`/dashboard/proposals`);
        revalidatePath(`/dashboard/leads/${leadId}`);
        return { success: true, proposalId: revision.id };
    } catch (error) {
        console.error("Failed to create proposal revision:", error);
        return { success: false, message: "Database Error" };
    }
}


const DEFAULT_PAYMENT_SCHEDULE_ITEMS = [
    { label: "On signing", percent: 30, trigger: "on_signing", sortOrder: 0 },
    { label: "After design approval", percent: 30, trigger: "design", sortOrder: 1 },
    { label: "On handover", percent: 40, trigger: "handover", sortOrder: 2 },
] as const;

export async function seedDefaultPaymentSchedule(proposalId: string) {
    const existing = await db.query.paymentScheduleItems.findFirst({
        where: eq(paymentScheduleItems.proposalId, proposalId),
    });
    if (!existing) {
        for (const item of DEFAULT_PAYMENT_SCHEDULE_ITEMS) {
            await db.insert(paymentScheduleItems).values({
                proposalId,
                label: item.label,
                percent: item.percent,
                trigger: item.trigger,
                sortOrder: item.sortOrder,
            });
        }
    }
}

export async function getPaymentSchedule(proposalId: string) {
    const items = await db.query.paymentScheduleItems.findMany({
        where: eq(paymentScheduleItems.proposalId, proposalId),
        orderBy: (psi, { asc }) => [asc(psi.sortOrder), asc(psi.createdAt)],
    });
    return items;
}

export async function savePaymentSchedule(
    proposalId: string,
    items: Array<{ id?: string; label: string; percent: number; trigger: string; sortOrder?: number }>
) {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can edit payment schedules" };
    }

    if (!items || items.length === 0) {
        return { success: false, message: "At least one payment schedule item is required" };
    }

    const totalPercent = items.reduce((sum, item) => sum + (Number(item.percent) || 0), 0);
    if (totalPercent !== 100) {
        return {
            success: false,
            message: `Payment schedule percentages must total exactly 100% (currently ${totalPercent}%)`,
        };
    }

    for (const item of items) {
        if (!item.label || !item.label.trim()) {
            return { success: false, message: "Label is required for every payment item" };
        }
    }

    try {
        const proposal = await db.query.proposals.findFirst({
            where: eq(proposals.id, proposalId),
        });
        if (!proposal) return { success: false, message: "Proposal not found" };

        await db.delete(paymentScheduleItems).where(eq(paymentScheduleItems.proposalId, proposalId));

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            await db.insert(paymentScheduleItems).values({
                proposalId,
                label: item.label.trim(),
                percent: Math.round(Number(item.percent)),
                trigger: (item.trigger || "on_signing") as any,
                sortOrder: item.sortOrder !== undefined ? item.sortOrder : i,
            });
        }

        await logAction("UPDATE", "Proposal", `Updated payment schedule (100%) for Proposal ${proposal.proposalCode || proposalId}`);
        revalidatePath(`/dashboard/proposals/builder/${proposalId}`);
        revalidatePath(`/dashboard/proposals/${proposalId}`);
        revalidatePath(`/proposal/${proposalId}`);

        const updated = await getPaymentSchedule(proposalId);
        return { success: true, items: updated };
    } catch (error) {
        console.error("Failed to save payment schedule:", error);
        return { success: false, message: "Database Error" };
    }
}


export async function sendProposal(proposalId: string) {
    const authz = await requireRole(["manager"]);
    if (!authz.ok) {
        return { success: false, message: "Unauthorized: Only managers can send proposals" };
    }

    try {
        let sentProposalCode = "";
        let leadId = "";
        let proposalVersion = 1;

        await db.transaction(async (tx) => {
            // 1. Lock proposal row FOR UPDATE
            const [lockedProposal] = await tx
                .select()
                .from(proposals)
                .where(eq(proposals.id, proposalId))
                .for("update");

            if (!lockedProposal) {
                throw new Error("Proposal not found during lock");
            }

            if (lockedProposal.status !== "draft") {
                throw new Error(`Only draft proposals can be sent. Current status is '${lockedProposal.status}'.`);
            }

            // 2. Lock lead row FOR UPDATE
            const [lockedLead] = await tx
                .select()
                .from(leads)
                .where(eq(leads.id, lockedProposal.leadId))
                .for("update");

            if (!lockedLead) {
                throw new Error("Lead not found during lock");
            }

            leadId = lockedLead.id;
            sentProposalCode = lockedProposal.proposalCode || proposalId;
            proposalVersion = lockedProposal.version ?? 1;

            // 3. Move milestone, price and schedule validation inside transaction after both locks
            const milestones = await tx
                .select()
                .from(proposalMilestones)
                .where(eq(proposalMilestones.proposalId, proposalId));

            const map = new Map(milestones.map((m) => [m.name, m]));
            const requiredKeys = ["requirements", "design", "development", "uat_testing", "handover"] as const;
            for (const k of requiredKeys) {
                const m = map.get(k);
                if (!m || !m.startDate || !m.endDate) {
                    throw new Error("Cannot send proposal: all 5 default milestones must have valid start and end dates.");
                }
                const startTime = new Date(m.startDate).getTime();
                const endTime = new Date(m.endDate).getTime();
                if (isNaN(startTime) || isNaN(endTime) || endTime < startTime) {
                    throw new Error(`Cannot send proposal: milestone "${k}" end date must be on or after start date.`);
                }
            }

            // For priced proposals use totalPrice only (> 0), never the legacy total
            if (lockedProposal.priceMode === "priced") {
                const totalPrice = lockedProposal.totalPrice ?? 0;
                if (totalPrice <= 0) {
                    throw new Error("Cannot send priced proposal without a valid total price.");
                }

                const schedule = await tx
                    .select()
                    .from(paymentScheduleItems)
                    .where(eq(paymentScheduleItems.proposalId, proposalId));

                const sumPercent = schedule.reduce((sum, item) => sum + (Number(item.percent) || 0), 0);
                if (sumPercent !== 100) {
                    throw new Error(`Cannot send proposal: payment schedule must total exactly 100% (currently ${sumPercent}%).`);
                }
            }

            // 4. Stage transition logic: check result of moveLeadToProposalSent
            if (lockedLead.status === "Discovery & Qualifying") {
                const transitionRes = await moveLeadToProposalSent(tx, leadId);
                if (!transitionRes?.success) {
                    throw new Error(transitionRes?.message || "Failed to move lead to Proposal Sent");
                }
            } else if (lockedLead.status === "Proposal Sent" || lockedLead.status === "In Negotiation") {
                // Already in or past Proposal Sent; send proposal without stage change or activity interaction
            } else {
                throw new Error(`Cannot send proposal for lead in stage "${lockedLead.status}"`);
            }

            const now = new Date();

            // 5. Update proposal status = "sent"
            await tx.update(proposals)
                .set({
                    status: "sent",
                    sentAt: now,
                    updatedAt: now,
                })
                .where(eq(proposals.id, proposalId));

            // 6. Mark previous versions replaced ONLY where status IN ('sent','pricing_meeting_requested','changes_requested')
            await tx.update(proposals)
                .set({
                    status: "replaced",
                    updatedAt: now,
                })
                .where(
                    and(
                        eq(proposals.leadId, leadId),
                        ne(proposals.id, proposalId),
                        inArray(proposals.status, ["sent", "pricing_meeting_requested", "changes_requested"])
                    )
                );
        });

        // Post-commit side-effects
        try {
            const { notifyLeadClient } = await import("@/features/notifications/send");
            await notifyLeadClient(
                leadId,
                `Your Project Proposal (${sentProposalCode}) has been published and is ready for your review.`,
                "proposal",
                `/proposal/${proposalId}`
            );
        } catch (notifyErr) {
            console.warn("Client notification failed:", notifyErr);
        }

        try {
            await sendProposalEmail(proposalId);
        } catch (emailErr) {
            console.warn("Email dispatch failed:", emailErr);
        }

        await logAction("UPDATE", "Proposal", `Proposal ${sentProposalCode} (v${proposalVersion}) sent to client`);

        revalidatePath(`/dashboard/proposals`);
        revalidatePath(`/dashboard/proposals/${proposalId}`);
        revalidatePath(`/dashboard/proposals/builder/${proposalId}`);
        revalidatePath(`/dashboard/leads/${leadId}`);
        revalidatePath(`/proposal/${proposalId}`);

        return { success: true, proposalId, version: proposalVersion, status: "sent" };
    } catch (error: unknown) {
        console.error("Failed to send proposal:", error);
        return { success: false, message: error instanceof Error ? error.message : "Database Error" };
    }
}
