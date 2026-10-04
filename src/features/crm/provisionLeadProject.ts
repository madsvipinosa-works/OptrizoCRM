import "server-only";

import { db } from "@/db";
import {
    agencyProjects,
    leads,
    milestones,
    projectStakeholders,
    proposals,
    serviceTemplates,
    tasks,
    users,
} from "@/db/schema";
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
        if (!internalRoles.includes(lead.client.role)) {
            await tx.update(users).set({ role: "client" }).where(eq(users.id, lead.clientId));
        }

        const proposal = await tx.query.proposals.findFirst({
            where: and(eq(proposals.leadId, leadId), eq(proposals.status, "Approved")),
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

        await tx.insert(projectStakeholders).values({
            projectId: project.id,
            userId: lead.clientId,
        });

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
