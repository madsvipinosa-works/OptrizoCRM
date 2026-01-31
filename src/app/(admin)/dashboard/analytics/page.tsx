
import { db } from "@/db";
import { leads } from "@/db/schema";
import { sql } from "drizzle-orm";
import { AnalyticsCharts } from "@/components/admin/AnalyticsCharts";

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
    // 1. Fetch Key Metrics
    const totalLeads = await db.select({ count: sql<number>`count(*)` }).from(leads);

    // 2. Fetch Aggregated Data for Charts
    // Note: Drizzle aggregation is powerful, but for MVP we fetch and map in JS or use raw SQL.
    // For simplicity with SQLite/Postgres compatibility in this proto, we'll fetch all and aggregate.
    // In production, use `groupBy` SQL.

    const allLeads = await db.query.leads.findMany({
        columns: {
            status: true,
            score: true,
            budget: true,
            createdAt: true,
            service: true
        }
    });

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-glow">Analytics Dashboard</h2>
                <p className="text-muted-foreground">
                    Insights into lead performance and pipeline health.
                </p>
            </div>

            <AnalyticsCharts
                totalLeads={Number(totalLeads[0].count)}
                leadsData={allLeads}
            />
        </div>
    );
}
