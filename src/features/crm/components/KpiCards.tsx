"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Trophy, FolderKanban, CheckCircle2, TrendingUp } from "lucide-react";

interface KpiCardsProps {
    data: {
        pipelineValue: string;
        weightedPipelineValue?: string;
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
}

export function KpiCards({ data }: KpiCardsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Pipeline Value & Weighted Forecast */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-md relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/20 transition-all" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Pipeline Revenue
                    </CardTitle>
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <DollarSign className="h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent className="pt-2 space-y-2">
                    <div className="flex items-baseline justify-between">
                        <div className="text-3xl font-bold text-white tracking-tight drop-shadow-[0_0_12px_rgba(99,102,241,0.3)]">
                            {data.pipelineValue}
                        </div>
                    </div>
                    
                    {data.weightedPipelineValue && (
                        <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-xs">
                            <span className="text-zinc-400 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3 text-indigo-400" />
                                Weighted Forecast:
                            </span>
                            <span className="font-semibold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                {data.weightedPipelineValue}
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Card 2: Win/Loss Rate */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Win / Loss Rate
                    </CardTitle>
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Trophy className="h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent className="pt-2">
                    <div className="text-3xl font-bold text-white tracking-tight drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                        {data.winRatePercentage}%
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">
                        <span className="font-medium text-emerald-400">{data.wonLeadsCount} won</span> / {data.totalClosedCount} closed deals
                    </p>
                </CardContent>
            </Card>

            {/* Card 3: Active Projects */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-md relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/20 transition-all" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Active Delivery Projects
                    </CardTitle>
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <FolderKanban className="h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent className="pt-2">
                    <div className="text-3xl font-bold text-white tracking-tight drop-shadow-[0_0_12px_rgba(59,130,246,0.3)]">
                        {data.activeProjectsCount}
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">
                        In active milestone fulfillment
                    </p>
                </CardContent>
            </Card>

            {/* Card 4: Task Completion Velocity */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-md relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Task Delivery Velocity
                    </CardTitle>
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent className="pt-2">
                    <div className="text-3xl font-bold text-white tracking-tight drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                        {data.taskCompletionRate}%
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">
                        <span className="font-medium text-amber-400">{data.doneTasksCount}</span> of {data.totalTasksCount} tasks completed
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
