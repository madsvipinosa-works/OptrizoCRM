import "server-only";

import { db } from "@/db";
import {
    agencyProjects,
    leads,
    milestones,
    payments,
    paymentScheduleItems,
    projectStakeholders,
    proposalMilestones,
    proposals,
    serviceTemplates,
    tasks,
    users,
} from "@/db/schema";
import { DEFAULT_PROPOSAL_MILESTONES } from "@/features/proposals/constants";
import { sendClientWelcomeEmail } from "@/lib/notifications";
import { and, eq, sql } from "drizzle-orm";

export async function provisionLeadProject(leadId: string) {
    const result = await db.transaction(async (tx) => {
        // Serialize simultaneous conversions for this lead so only one project
        // and one set of delivery milestones can be created.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${leadId}))`);

        const lead = await tx.query.leads.findFirst({
            where: eq(leads.id, leadId),
            with: { client: true },
        });
        if (!lead) return { success: false as const, message: "Lead not found" };
        if (!lead.client) {
            return { success: false as const, message: "Client account not associated with this lead" };
        }

        const existingProject = await tx.query.agencyProjects.findFirst({
            where: eq(agencyProjects.leadId, leadId),
            columns: { id: true, title: true },
        });
        if (existingProject) {
            if (lead.status !== "Closed Won") {
                await tx.update(leads)
                    .set({ status: "Closed Won", closedWonAt: new Date(), updatedAt: new Date() })
                    .where(eq(leads.id, leadId));
            }
            return {
                success: true as const,
                projectId: existingProject.id,
                projectTitle: existingProject.title,
                lead,
                created: false,
            };
        }

        const internalRoles = ["superadmin", "sales", "manager", "developer", "content_editor"];
        if (lead.clientId && !internalRoles.includes(lead.client.role)) {
            await tx.update(users).set({ role: "client" }).where(eq(users.id, lead.clientId));
        }

        const proposal = await tx.query.proposals.findFirst({
            where: and(eq(proposals.leadId, leadId), eq(proposals.status, "signed")),
            orderBy: (proposal, { desc }) => [desc(proposal.updatedAt)],
        });
        const proposalDeliverables = Array.isArray(proposal?.deliverables)
            ? proposal.deliverables
            : [];
        const proposalTimeline = proposal?.timeline?.trim();
        const projectDescription = [
            lead.goals || `Client project originating from sales opportunity for ${lead.businessName || lead.client.name}`,
            proposalTimeline ? `Approved proposal timeline: ${proposalTimeline}` : null,
        ].filter(Boolean).join("\n\n");
        const projectTitle = lead.businessName
            ? `${lead.businessName} Project`
            : `${lead.client.name || "Client"} Project`;

        const [project] = await tx.insert(agencyProjects).values({
            title: projectTitle,
            description: projectDescription,
            leadId: lead.id,
            status: "Kickoff",
        }).returning({ id: agencyProjects.id, title: agencyProjects.title });

        if (lead.clientId) {
            await tx.insert(projectStakeholders).values({
                projectId: project.id,
                userId: lead.clientId,
            });
        }

        let proposalScopeCreated = false;
        if (proposalDeliverables.length > 0) {
            for (const [index, deliverable] of proposalDeliverables.entries()) {
                const title = deliverable?.name?.trim() || `Phase ${index + 1}`;
                const [milestone] = await tx.insert(milestones).values({
                    projectId: project.id,
                    title,
                    order: index + 1,
                    status: "Pending",
                }).returning({ id: milestones.id });

                await tx.insert(tasks).values({
                    projectId: project.id,
                    milestoneId: milestone.id,
                    title: `Deliverable: ${title}`,
                    description: deliverable?.description || "Refer to the approved proposal for details.",
                    requiresProof: true,
                    status: "Todo",
                });
            }
            proposalScopeCreated = true;
        }

        if (!proposalScopeCreated && lead.serviceId) {
            const template = await tx.query.serviceTemplates.findFirst({
                where: eq(serviceTemplates.id, lead.serviceId),
                with: { tasks: true },
            });
            if (template?.tasks.length) {
                const milestoneGroups = new Map<string, typeof template.tasks>();
                for (const taskTemplate of template.tasks) {
                    const key = `${taskTemplate.milestoneOrder}:${taskTemplate.milestoneTitle}`;
                    milestoneGroups.set(key, [...(milestoneGroups.get(key) || []), taskTemplate]);
                }

                for (const [key, taskTemplates] of milestoneGroups) {
                    const [orderText, ...titleParts] = key.split(":");
                    const [milestone] = await tx.insert(milestones).values({
                        projectId: project.id,
                        title: titleParts.join(":"),
                        order: Number(orderText),
                        status: "Pending",
                    }).returning({ id: milestones.id });
                    await tx.insert(tasks).values(taskTemplates.map((taskTemplate) => ({
                        projectId: project.id,
                        milestoneId: milestone.id,
                        title: taskTemplate.title,
                        description: taskTemplate.description,
                        requiresProof: taskTemplate.requiresProof,
                        status: "Todo" as const,
                    })));
                }
                proposalScopeCreated = true;
            }
        }

        if (!proposalScopeCreated) {
            const [kickoff] = await tx.insert(milestones).values({
                projectId: project.id,
                title: "Project Kickoff & Discovery",
                order: 1,
                status: "In Progress",
            }).returning({ id: milestones.id });
            await tx.insert(tasks).values([
                {
                    projectId: project.id,
                    milestoneId: kickoff.id,
                    title: "Client Onboarding & Access Handshake",
                    description: "Acquire repository, hosting, and asset credentials.",
                    requiresProof: false,
                    status: "In Progress" as const,
                },
                {
                    projectId: project.id,
                    milestoneId: kickoff.id,
                    title: "Technical Specification & Architecture Review",
                    description: "Formalize deliverable requirements and engineering milestones.",
                    requiresProof: true,
                    status: "Todo" as const,
                },
            ]);
            const [delivery] = await tx.insert(milestones).values({
                projectId: project.id,
                title: "Core Implementation & Delivery",
                order: 2,
                status: "Pending",
            }).returning({ id: milestones.id });
            await tx.insert(tasks).values({
                projectId: project.id,
                milestoneId: delivery.id,
                title: "Core Feature Sprints",
                description: "Execute scoped sprint deliverables.",
                requiresProof: true,
                status: "Todo",
            });
        }

        const finalWonValue = proposal?.total && proposal.total > 0
            ? proposal.total
            : lead.estimatedValue;
        await tx.update(leads)
            .set({ status: "Closed Won", estimatedValue: finalWonValue, closedWonAt: new Date(), updatedAt: new Date() })
            .where(eq(leads.id, leadId));

        return {
            success: true as const,
            projectId: project.id,
            projectTitle: project.title,
            lead,
            created: true,
        };
    });

    if (!result.success) return result;

    if (result.created) {
        try {
            await sendClientWelcomeEmail({
                name: result.lead.client?.name || "Client",
                email: result.lead.client?.email || "",
                projectName: result.projectTitle,
            });
        } catch (error) {
            console.error("Failed to send project welcome email:", error);
        }
    }

    return result;
}

export interface ProposalForProvisioning {
    id: string;
    leadId: string;
    priceMode?: "unpriced" | "priced" | string | null;
    totalPrice?: number | null;
    total?: number | null;
    currency?: string | null;
    timeline?: string | null;
    milestones?: Array<{
        name?: string | null;
        startDate?: Date | string | null;
        endDate?: Date | string | null;
    }> | null;
    paymentScheduleItems?: Array<{
        id: string;
        label: string;
        percent: number;
        trigger: "on_signing" | "requirements" | "design" | "development" | "uat_testing" | "handover" | "before_completion";
        sortOrder?: number | null;
    }> | null;
}

/**
 * Provisions a delivery project from an accepted/signed proposal in an existing transaction tx.
 * 1. Serializes with pg_advisory_xact_lock(hashtext(leadId)).
 * 2. Requires lead.clientId (throws if missing to rollback).
 * 3. Idempotently returns existing project if one already exists for this lead.
 * 4. Inserts agency_project with status "Kickoff".
 * 5. Links client as projectStakeholder.
 * 6. Inserts 5 default milestones with exact titles and copied proposal dates (first In Progress, rest Pending).
 * 7. Inserts payment records from paymentScheduleItems (on_signing becomes due with 14-day window).
 */
export async function provisionProjectFromProposal(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    proposal: ProposalForProvisioning
) {
    if (!proposal.leadId) {
        throw new Error("Cannot provision project: proposal has no associated lead");
    }

    // 1. Serialize using advisory transaction lock on leadId
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${proposal.leadId}))`);

    // 2. Fetch the lead and verify clientId exists
    const lead = await tx.query.leads.findFirst({
        where: eq(leads.id, proposal.leadId),
        with: { client: true },
    });
    if (!lead) {
        throw new Error(`Cannot provision project: lead ${proposal.leadId} not found`);
    }
    if (!lead.clientId) {
        throw new Error(`Cannot provision project: lead ${proposal.leadId} has no client associated`);
    }

    // 3. Idempotence: If lead already has a project, return existing project without creating another
    const existingProject = await tx.query.agencyProjects.findFirst({
        where: eq(agencyProjects.leadId, proposal.leadId),
    });
    if (existingProject) {
        return {
            project: existingProject,
            milestones: [],
            payments: [],
            alreadyExisted: true,
        };
    }

    // 4. Validate payment schedule items before any inserts
    const scheduleItems = proposal.paymentScheduleItems || await tx.query.paymentScheduleItems.findMany({
        where: eq(paymentScheduleItems.proposalId, proposal.id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orderBy: (item: any, { asc }: any) => [asc(item.sortOrder)],
    });

    // Sort paymentScheduleItems by sortOrder before allocating amounts
    const sortedScheduleItems = [...(scheduleItems || [])].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );

    const totalPrice = Number(proposal.totalPrice ?? proposal.total ?? 0);
    const currency = (proposal.currency || "PHP") as "PHP" | "USD";

    // Throw if a priced proposal has no schedule items or the percents do not sum to 100
    if (proposal.priceMode === "priced" || totalPrice > 0) {
        if (sortedScheduleItems.length === 0) {
            throw new Error(`Cannot provision project: priced proposal ${proposal.id} has no payment schedule items`);
        }
        const totalPercent = sortedScheduleItems.reduce(
            (acc, item) => acc + (Number(item.percent) || 0),
            0
        );
        if (totalPercent !== 100) {
            throw new Error(`Cannot provision project: proposal payment schedule items must total 100%, got ${totalPercent}%`);
        }
    }

    // 5. Client role check/update if needed
    const internalRoles = ["superadmin", "sales", "manager", "developer", "content_editor"];
    if (lead.client && !internalRoles.includes(lead.client.role)) {
        await tx.update(users).set({ role: "client" }).where(eq(users.id, lead.clientId));
    }

    // 6. Create agency_project
    const projectTitle = lead.businessName
        ? `${lead.businessName} Project`
        : `${lead.client?.name || "Client"} Project`;

    const projectDescription = [
        lead.goals || `Client project originating from proposal for ${lead.businessName || lead.client?.name}`,
        proposal.timeline ? `Approved proposal timeline: ${proposal.timeline}` : null,
    ].filter(Boolean).join("\n\n");

    const [project] = await tx.insert(agencyProjects).values({
        title: projectTitle,
        description: projectDescription,
        leadId: lead.id,
        status: "Kickoff",
    }).returning();

    // 7. Stakeholder = client
    await tx.insert(projectStakeholders).values({
        projectId: project.id,
        userId: lead.clientId,
    });

    // 8. 5 Milestones named from proposal_milestone with their dates
    // First is "In Progress", remaining four are "Pending"
    // Fetch proposal milestones if not already passed on proposal object
    const propMilestones = proposal.milestones || await tx.query.proposalMilestones.findMany({
        where: eq(proposalMilestones.proposalId, proposal.id),
    });
    const milestoneDateMap = new Map<string, { startDate?: Date | null; endDate?: Date | null }>();
    if (Array.isArray(propMilestones)) {
        for (const pm of propMilestones) {
            if (pm?.name) {
                milestoneDateMap.set(pm.name, {
                    startDate: pm.startDate ? new Date(pm.startDate) : null,
                    endDate: pm.endDate ? new Date(pm.endDate) : null,
                });
            }
        }
    }

    const createdMilestones = [];
    for (let i = 0; i < DEFAULT_PROPOSAL_MILESTONES.length; i++) {
        const def = DEFAULT_PROPOSAL_MILESTONES[i];
        const dates = milestoneDateMap.get(def.name);
        const [m] = await tx.insert(milestones).values({
            projectId: project.id,
            name: def.name,
            title: def.title,
            order: i,
            status: i === 0 ? "In Progress" : "Pending",
            startDate: dates?.startDate || null,
            endDate: dates?.endDate || null,
        }).returning();
        createdMilestones.push(m || { name: def.name, title: def.title });
    }

    // 9. Payment rows from paymentScheduleItems
    let allocatedSum = 0;
    const createdPayments = [];
    for (let i = 0; i < sortedScheduleItems.length; i++) {
        const item = sortedScheduleItems[i];
        const isLast = i === sortedScheduleItems.length - 1;
        const amount = isLast
            ? totalPrice - allocatedSum
            : Math.round((totalPrice * item.percent) / 100);
        allocatedSum += amount;

        const isOnSigning = item.trigger === "on_signing";
        const dueDate = isOnSigning
            ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            : null;

        const [p] = await tx.insert(payments).values({
            projectId: project.id,
            scheduleItemId: item.id,
            label: item.label,
            percent: item.percent,
            amount,
            currency,
            status: isOnSigning ? "due" : "not_yet_due",
            becameDueAt: isOnSigning ? new Date() : null,
            dueDate,
        }).returning();
        createdPayments.push({
            ...(p || {}),
            projectId: project.id,
            scheduleItemId: item.id,
            label: item.label,
            percent: item.percent,
            amount,
            currency,
            status: isOnSigning ? "due" : "not_yet_due",
            dueDate,
        });
    }

    return {
        project,
        milestones: createdMilestones,
        payments: createdPayments,
        alreadyExisted: false,
    };
}
