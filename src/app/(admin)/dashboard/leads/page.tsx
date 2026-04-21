import { db } from "@/db";
import { leads, users, leadAssignees } from "@/db/schema";
import { desc, like, eq, and, or, inArray } from "drizzle-orm";
import { LeadsFilter } from "@/features/crm/components/LeadsFilter";
import { LeadsBoard } from "@/features/crm/components/LeadsBoard"; 
import { Suspense } from "react";
import { auth } from "@/auth"; // Need auth for current user ID

export const dynamic = 'force-dynamic';

export default async function LeadsPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string;
        status?: string;
    }>;
}) {
    const session = await auth();
    const currentUserId = session?.user?.id || "";
    const isAdmin = session?.user?.role === "admin";
    const isEditor = session?.user?.role === "editor";

    // Role-based CRM visibility:
    // - Admin sees all non-archived leads.
    // - Editor (General Staff) sees only leads explicitly assigned to them.
    let assignedLeadIds: string[] = [];
    if (isEditor && session?.user?.id) {
        const assigned = await db.query.leadAssignees.findMany({
            where: eq(leadAssignees.userId, session.user.id),
            columns: { leadId: true },
        });
        assignedLeadIds = assigned.map(a => a.leadId);
    }

    const params = await searchParams;
    const query = params?.query || "";
    const status = params?.status || "";

    // Build Where Clause
    const whereClause = and(
        eq(leads.isArchived, false),
        !isAdmin ? inArray(leads.id, assignedLeadIds) : undefined,
        status && status !== "all" ? eq(leads.status, status as "New" | "Contacted" | "In Progress" | "Completed" | "Lost") : undefined,
        query
            ? or(
                like(leads.name, `%${query}%`),
                like(leads.email, `%${query}%`),
                like(leads.subject, `%${query}%`)
            )
            : undefined
    );

    // Fetch leads descending by creation date
    const leadsList = await db.query.leads.findMany({
        where: whereClause,
        with: {
            notesList: {
                with: {
                    author: true,
                },
                orderBy: (notes, { desc }) => [desc(notes.createdAt)],
            },
            assignees: { with: { user: true } },
            proposals: {
                orderBy: (p, { desc }) => [desc(p.createdAt)]
            },
        },
        orderBy: [desc(leads.createdAt)],
    });

    // Fetch potential assignees (Admins/Editors)
    const assignableUsers = await db.query.users.findMany({
        columns: { id: true, name: true, image: true, jobTitle: true },
        where: inArray(users.role, ["admin", "editor"]),
    });

    // Serialize dates for Client Component
    const serializedLeads = leadsList.map(lead => ({
        ...lead,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
        nextActionDate: lead.nextActionDate ? lead.nextActionDate.toISOString() : null,
        assignees: lead.assignees?.map(a => a.user) || [],
    }));

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-glow">Lead Pipeline</h2>
                <p className="text-muted-foreground">
                    Manage incoming project inquiries and potential clients.
                </p>
            </div>

            <Suspense fallback={<div className="h-10 w-full bg-white/5 animate-pulse rounded-md" />}>
                <LeadsFilter />
            </Suspense>

            <LeadsBoard
                leads={serializedLeads as unknown as React.ComponentProps<typeof LeadsBoard>['leads']}
                assignableUsers={assignableUsers}
                currentUserId={currentUserId}
                query={query}
                status={status}
                isAdmin={isAdmin}
            />
        </div>
    );
}
