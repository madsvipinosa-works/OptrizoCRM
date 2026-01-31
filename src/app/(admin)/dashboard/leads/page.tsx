import { db } from "@/db";
import { leads, users } from "@/db/schema";
import { desc, like, eq, and, or, inArray } from "drizzle-orm";
import { LeadCard } from "@/features/crm/components/LeadCard";
import { LeadsFilter } from "@/features/crm/components/LeadsFilter";
import { Suspense } from "react";

export const dynamic = 'force-dynamic';

export default async function LeadsPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string;
        status?: string;
    }>;
}) {
    const params = await searchParams;
    const query = params?.query || "";
    const status = params?.status || "";

    // Build Where Clause
    const whereClause = and(
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
            assignee: true, // Fetch current assignee
        },
        orderBy: [desc(leads.createdAt)],
    });

    // Fetch potential assignees (Admins/Editors)
    const assignableUsers = await db.query.users.findMany({
        columns: { id: true, name: true, image: true },
        where: inArray(users.role, ["admin", "editor"]),
    });

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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {leadsList.length === 0 ? (
                    <div className="col-span-full p-8 text-center border border-dashed rounded-lg text-muted-foreground">
                        {query || status ? "No leads found matching your filters." : "No leads yet."}
                    </div>
                ) : (
                    leadsList.map((lead) => (
                        <LeadCard
                            key={lead.id}
                            lead={{
                                ...lead,
                                createdAt: lead.createdAt.toISOString()
                            }}
                            assignableUsers={assignableUsers}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
