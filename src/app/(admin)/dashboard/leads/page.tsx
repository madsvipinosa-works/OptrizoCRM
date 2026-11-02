import { db } from "@/db";
import { leads, users, leadAssignees } from "@/db/schema";
import { desc, like, eq, and, or, inArray, isNull, sql } from "drizzle-orm";
import { LeadsBoard } from "@/features/crm/components/LeadsBoard"; 
import { CreateLeadModal } from "@/features/crm/components/CreateLeadModal";
import { auth, hasRole } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function LeadsPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string;
        status?: string;
        leadId?: string;
    }>;
}) {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    if (!hasRole(session, ["sales"])) {
        redirect("/dashboard");
    }

    const currentUserId = session.user.id;
    const isSales = session.user.role === "sales";

    // Role-based CRM visibility:
    // - Sales sees leads assigned to them plus unassigned leads.
    const assigned = await db.query.leadAssignees.findMany({
        where: eq(leadAssignees.userId, currentUserId),
        columns: { leadId: true },
    });
    const assignedLeadIds = assigned.map(a => a.leadId);

    const params = await searchParams;
    const query = params?.query || "";
    const status = params?.status || "";
    const focusedLeadId = params?.leadId || "";

    // Build the where clause from the aliased table that the relational query
    // passes in, so the correlated subquery references "leads" and not "lead".
    const whereClause = (lead: { id: typeof leads.id; status: typeof leads.status; businessName: typeof leads.businessName; industry: typeof leads.industry; archivedAt: typeof leads.archivedAt }) => {
        const unassigned = sql`not exists (select 1 from "lead_assignee" la where la."leadId" = ${lead.id})`;
        const visibility =
            assignedLeadIds.length > 0
                ? or(inArray(lead.id, assignedLeadIds), unassigned)
                : unassigned;
        return and(
            isNull(lead.archivedAt),
            visibility,
            status && status !== "all" ? eq(lead.status, status as any) : undefined,
            query
                ? or(
                    like(lead.businessName, `%${query}%`),
                    like(lead.industry, `%${query}%`)
                )
                : undefined
        );
    };

    const leadsList = await db.query.leads.findMany({
        where: whereClause,
        with: {
            client: true, // Need client details for display
            activityLogs: {
                with: {
                    author: true,
                },
                orderBy: (logs, { desc }) => [desc(logs.createdAt)],
            },
            assignees: { with: { user: true } },
            proposals: {
                where: (p, { isNull }) => isNull(p.deletedAt),
                orderBy: (p, { desc }) => [desc(p.updatedAt)]
            },
            crmTasks: {
                with: { assignee: true },
                orderBy: (t, { asc }) => [asc(t.dueDate)]
            }
        },
        orderBy: [desc(leads.createdAt)],
    });

    // Sales staff may open an unassigned lead from the daily overview so they
    // can claim it, without exposing leads already assigned to another rep.
    if (focusedLeadId && !leadsList.some((lead) => lead.id === focusedLeadId)) {
        const focusedLead = await db.query.leads.findFirst({
            where: eq(leads.id, focusedLeadId),
            with: {
                client: true,
                activityLogs: {
                    with: { author: true },
                    orderBy: (logs, { desc }) => [desc(logs.createdAt)],
                },
                assignees: { with: { user: true } },
                proposals: {
                    where: (proposal, { isNull }) => isNull(proposal.deletedAt),
                    orderBy: (proposal, { desc }) => [desc(proposal.updatedAt)]
                },
                crmTasks: {
                    with: { assignee: true },
                    orderBy: (task, { asc }) => [asc(task.dueDate)],
                },
            },
        });
        if (focusedLead && focusedLead.assignees.length === 0) {
            leadsList.push(focusedLead);
        }
    }

    // Fetch potential assignees (Sales staff)
    const assignableUsers = await db.query.users.findMany({
        columns: { id: true, name: true, image: true, jobTitle: true, role: true },
        where: inArray(users.role, ["sales"]),
    });

    // Serialize dates for Client Component
    const serializedLeads = leadsList.map(lead => ({
        ...lead,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
        lastContactedAt: lead.lastContactedAt ? lead.lastContactedAt.toISOString() : null,
        nextFollowUpDate: lead.nextFollowUpDate ? lead.nextFollowUpDate.toISOString() : null,
        assignees: lead.assignees?.map(a => a.user) || [],
        crmTasks: lead.crmTasks?.map(t => ({
            ...t,
            dueDate: t.dueDate ? t.dueDate.toISOString() : null,
            completedAt: t.completedAt ? t.completedAt.toISOString() : null,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString()
        })) || []
    }));
    const focusedLeadCanBeClaimed = leadsList.some(
        (lead) => lead.id === focusedLeadId && lead.assignees.length === 0
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-glow">Sales Pipeline</h2>
                    <p className="text-muted-foreground">
                        Manage inquiries and active deals.
                    </p>
                </div>
                {isSales && (
                    <CreateLeadModal assignableUsers={assignableUsers} />
                )}
            </div>

            <LeadsBoard
                leads={serializedLeads as unknown as React.ComponentProps<typeof LeadsBoard>['leads']}
                assignableUsers={assignableUsers}
                currentUserId={currentUserId}
                query={query}
                status={status}
                isAdmin={isSales || focusedLeadCanBeClaimed}
                initialLeadId={focusedLeadId}
            />
        </div>
    );
}
