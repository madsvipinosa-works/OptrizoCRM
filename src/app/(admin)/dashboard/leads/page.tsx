import { db } from "@/db";
import { leads, users, leadAssignees } from "@/db/schema";
import { desc, like, eq, and, or, inArray, isNull, sql } from "drizzle-orm";
import { LeadsBoard } from "@/features/crm/components/LeadsBoard"; 
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
    // Old links (?leadId=) now open the lead's own page, which runs its own access check.
    if (focusedLeadId) redirect(`/dashboard/leads/${focusedLeadId}`);

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
            // Only the user columns the UI shows: never send password hashes to the browser.
            client: { columns: { name: true, email: true } },
            service: { columns: { id: true, title: true } },
            activityLogs: {
                with: {
                    author: { columns: { id: true, name: true } },
                },
                orderBy: (logs, { desc }) => [desc(logs.createdAt)],
            },
            assignees: { with: { user: { columns: { id: true, name: true, image: true, jobTitle: true, role: true } } } },
            proposals: {
                where: (p, { isNull }) => isNull(p.deletedAt),
                orderBy: (p, { desc }) => [desc(p.updatedAt)]
            },
            crmTasks: {
                with: { assignee: { columns: { id: true, name: true, image: true } } },
                orderBy: (t, { asc }) => [asc(t.dueDate)]
            }
        },
        orderBy: [desc(leads.createdAt)],
    });

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
    // Header (title, Board/Table switch, actions) is rendered by the pipeline view,
    // so the switch can sit in the header row as in mockup step 2 / 2a.
    return (
        <LeadsBoard
            leads={serializedLeads as unknown as React.ComponentProps<typeof LeadsBoard>['leads']}
            assignableUsers={assignableUsers}
            currentUserId={currentUserId}
            query={query}
            status={status}
            isAdmin={isSales}
            canCreate={isSales}
        />
    );
}
