"use server";

import { db } from "@/db";
import { leads, leadNotes } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { leadUpdateSchema, type LeadUpdateValues } from "@/lib/schemas";
import { auth } from "@/auth";

export type ActionState = {
    message?: string;
    success?: boolean;
    errors?: Record<string, string[]>;
};

export async function updateLead(id: string, data: LeadUpdateValues): Promise<ActionState> {
    // 1. Auth Check (Admin or Editor)
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized: Access required." };
    }

    // 2. Validate Input
    const validated = leadUpdateSchema.safeParse(data);
    if (!validated.success) {
        return {
            success: false,
            message: "Validation failed",
            errors: validated.error.flatten().fieldErrors,
        };
    }

    // 3. Update Database
    try {
        await db.update(leads)
            .set({
                ...validated.data,
                updatedAt: new Date(),
            })
            .where(eq(leads.id, id));

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Lead updated successfully" };
    } catch (error) {
        console.error("Failed to update lead:", error);
        return { success: false, message: "Database error: Failed to update lead." };
    }
}

export async function addLeadNote(leadId: string, content: string, activityType: "Call" | "Email" | "Meeting" | "Note" = "Note"): Promise<ActionState> {
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    if (!content.trim()) {
        return { success: false, message: "Note cannot be empty" };
    }

    try {
        await db.insert(leadNotes).values({
            leadId,
            authorId: session.user.id!,
            content: content.trim(),
            activityType: activityType,
        });

        revalidatePath("/dashboard/leads");
        return { success: true, message: "Note added" };
    } catch (error) {
        console.error("Failed to add note:", error);
        return { success: false, message: "Failed to add note" };
    }
}

export async function getAnalyticsData() {
    // 1. Auth Check
    const session = await auth();
    if (!session?.user || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return null;
    }

    try {
        const allLeads = await db.select().from(leads);

        // 2. KPI Calculations
        const totalLeads = allLeads.length;
        const wonLeads = allLeads.filter(l => l.status === "Completed").length;
        const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : "0";

        // Estimate Revenue (naive parsing of budget string e.g. "$1k - $5k")
        const pipelineValue = allLeads
            .filter(l => l.status !== "Lost" && l.status !== "New") // Only active/won deals
            .reduce((acc, lead) => {
                if (!lead.budget) return acc;
                // Extract first number
                const match = lead.budget.match(/\d+/);
                const val = match ? parseInt(match[0]) : 0;
                // If it looks like 'k', multiply by 1000
                const multiplier = lead.budget.toLowerCase().includes('k') ? 1000 : 1;
                return acc + (val * multiplier);
            }, 0);

        // 3. Chart Data Preparation

        // Pipeline Distribution
        const pipelineData = [
            { name: "New", value: allLeads.filter(l => l.status === "New").length, fill: "#3b82f6" }, // blue
            { name: "Contacted", value: allLeads.filter(l => l.status === "Contacted").length, fill: "#a855f7" }, // purple
            { name: "In Progress", value: allLeads.filter(l => l.status === "In Progress").length, fill: "#eab308" }, // yellow
            { name: "Won", value: allLeads.filter(l => l.status === "Completed").length, fill: "#22c55e" }, // green
            { name: "Lost", value: allLeads.filter(l => l.status === "Lost").length, fill: "#6b7280" }, // gray
        ];

        // Lead Sources
        const sourceCounts: Record<string, number> = {};
        allLeads.forEach(l => {
            const src = l.source || "Direct";
            sourceCounts[src] = (sourceCounts[src] || 0) + 1;
        });
        const sourceData = Object.entries(sourceCounts).map(([name, value], i) => ({
            name,
            value,
            fill: ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"][i % 5]
        }));

        // Recent Trend (Last 30 Days)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        // Group by day
        const trendMap = new Map<string, number>();
        // Initialize last 30 days with 0
        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            trendMap.set(d.toISOString().split('T')[0], 0);
        }

        allLeads.forEach(l => {
            const dateStr = new Date(l.createdAt).toISOString().split('T')[0];
            if (trendMap.has(dateStr)) {
                trendMap.set(dateStr, (trendMap.get(dateStr) || 0) + 1);
            }
        });

        // Convert to array and reverse (oldest first)
        const trendData = Array.from(trendMap.entries())
            .map(([date, count]) => ({ date: date.slice(5), count })) // MM-DD
            .reverse();

        // Active Lead Management KPIs
        const now = new Date();
        let totalAgeDays = 0;
        let agedLeadsCount = 0;
        let staleLeadsCount = 0;
        let actionedLeadsCount = 0;

        allLeads.forEach(l => {
            const created = new Date(l.createdAt);
            const updated = new Date(l.updatedAt);
            const daysSinceCreation = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);
            const daysSinceUpdate = (now.getTime() - updated.getTime()) / (1000 * 3600 * 24);

            // Lead Aging: How long a lead has been "New"
            if (l.status === "New") {
                totalAgeDays += daysSinceCreation;
                agedLeadsCount++;
            }

            // Stale Leads: Not in terminal state AND untouched for > 2 days
            if (l.status !== "Completed" && l.status !== "Lost" && daysSinceUpdate > 2) {
                staleLeadsCount++;
            }

            // Response Rate: Leads moved out of "New"
            if (l.status !== "New") {
                actionedLeadsCount++;
            }
        });

        const avgLeadAgeDays = agedLeadsCount > 0 ? (totalAgeDays / agedLeadsCount).toFixed(1) : "0";
        const responseRate = totalLeads > 0 ? ((actionedLeadsCount / totalLeads) * 100).toFixed(0) : "0";

        return {
            kpi: {
                totalLeads,
                wonLeads,
                conversionRate,
                pipelineValue: pipelineValue.toLocaleString(),
                avgLeadAgeDays,
                staleLeadsCount,
                responseRate,
            },
            charts: {
                pipeline: pipelineData,
                sources: sourceData,
                trend: trendData
            }
        };

    } catch (error) {
        console.error("Analytics Error:", error);
        return null;
    }
}
