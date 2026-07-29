"use client";

import React from "react";
import { KpiCards } from "./KpiCards";
import { PipelineAreaChart } from "./PipelineAreaChart";
import { TaskDonutChart } from "./TaskDonutChart";
import { LeadSourceBarChart } from "./LeadSourceBarChart";
import { ActionQueue } from "./ActionQueue";
import { Sparkles, LayoutDashboard } from "lucide-react";

interface AnalyticsDashboardProps {
    data: {
        kpis: {
            pipelineValue: string;
            winRatePercentage: string;
            wonLeadsCount: number;
            lostLeadsCount: number;
            totalClosedCount: number;
            activeProjectsCount: number;
            taskCompletionRate: string;
            doneTasksCount: number;
            totalTasksCount: number;
            totalLeadsCount: number;
        };
        charts: {
            taskDonutData: Array<{ name: string; value: number; fill: string }>;
            leadSourceData: Array<{ name: string; total: number; won: number }>;
            trendData: Array<{ date: string; leads: number; won: number; value: number }>;
        };
        actionQueue: Array<{
            id: string;
            type: "blocked_task" | "pending_proposal" | "stale_lead";
            title: string;
            subtitle: string;
            urgency: "high" | "medium" | "low";
            link: string;
            badgeText: string;
            createdAt: string;
        }>;
    };
}

export function AnalyticsDashboard({ data }: AnalyticsDashboardProps) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <LayoutDashboard className="w-5 h-5 text-indigo-400" />
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                            Executive Agency Dashboard
                        </h1>
                    </div>
                    <p className="text-sm text-zinc-400">
                        Real-time intelligence across sales pipelines, delivery milestones, and operational bottlenecks.
                    </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Live Agency Telemetry</span>
                </div>
            </div>

            {/* 1. KPI Cards Row */}
            <KpiCards data={data.kpis} />

            {/* 2. Main Grid Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Columns: Revenue Velocity & Acquisition Channels */}
                <div className="lg:col-span-2 space-y-6">
                    <PipelineAreaChart data={data.charts.trendData} />
                    <LeadSourceBarChart data={data.charts.leadSourceData} />
                </div>

                {/* Right 1 Column: Task Distribution & Action Queue */}
                <div className="space-y-6 flex flex-col">
                    <TaskDonutChart data={data.charts.taskDonutData} />
                    <div className="flex-1 min-h-[300px]">
                        <ActionQueue items={data.actionQueue} />
                    </div>
                </div>
            </div>
        </div>
    );
}
