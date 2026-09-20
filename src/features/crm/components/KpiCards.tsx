"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Trophy, AlertTriangle, TrendingUp, FolderKanban } from "lucide-react";

interface KpiCardsProps {
    data: {
        pipelineValue: string;
        weightedPipelineValue?: string;
        winRatePercentage: string;
        wonLeadsCount: number;
        lostLeadsCount: number;
        totalClosedCount: number;
        activeProjectsCount: number;
        staleDealsCount?: number;
        taskCompletionRate: string;
        doneTasksCount: number;
        totalTasksCount: number;
        totalLeadsCount: number;
    };
}

export function KpiCards({ data }: KpiCardsProps) {
    const staleCount = data.staleDealsCount ?? 0;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Pipeline Value & Weighted Forecast */}
            <Card className="glass-card border-border relative overflow-hidden group hover:border-primary/40 transition-all duration-300 shadow-xs">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none group-hover:bg-primary/10 transition-all" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Pipeline Revenue
                    </CardTitle>
                    <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                        <DollarSign className="h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent className="pt-2 space-y-2">
                    <div className="flex items-baseline justify-between">
                        <div className="text-3xl font-bold text-foreground tracking-tight font-mono">
                            {data.pipelineValue}
                        </div>
                    </div>
                    
                    {data.weightedPipelineValue && (
                        <div className="flex items-center justify-between pt-1.5 border-t border-border text-xs">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <TrendingUp className="w-3 h-3 text-primary" />
                                Weighted Forecast:
                            </span>
                            <span className="font-semibold text-foreground dark:text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 font-mono">
                                {data.weightedPipelineValue}
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Card 2: Win/Loss Rate */}
            <Card className="glass-card border-border relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300 shadow-xs">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-all" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Win / Conversion Rate
                    </CardTitle>
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <Trophy className="h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent className="pt-2">
                    <div className="text-3xl font-bold text-foreground tracking-tight font-mono">
                        {data.winRatePercentage}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{data.wonLeadsCount} won</span> / {data.totalClosedCount} closed decisions
                    </p>
                </CardContent>
            </Card>

            {/* Card 3: Stale Deals / Response Alert */}
            <Card className={`glass-card relative overflow-hidden group transition-all duration-300 shadow-xs ${
                staleCount > 0 ? "border-amber-500/40 hover:border-amber-500/60" : "border-border hover:border-primary/40"
            }`}>
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-all ${
                    staleCount > 0 ? "bg-amber-500/10 group-hover:bg-amber-500/15" : "bg-muted/10"
                }`} />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Stale Deals Alert
                    </CardTitle>
                    <div className={`p-2 rounded-lg border ${
                        staleCount > 0
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-muted text-muted-foreground border-border"
                    }`}>
                        <AlertTriangle className="h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent className="pt-2">
                    <div className={`text-3xl font-bold tracking-tight font-mono ${
                        staleCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                    }`}>
                        {staleCount}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        {staleCount > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">Deals idle for &gt;5 days without contact</span>
                        ) : (
                            <span>All active deals contacted recently</span>
                        )}
                    </p>
                </CardContent>
            </Card>

            {/* Card 4: Active Projects & Delivery */}
            <Card className="glass-card border-border relative overflow-hidden group hover:border-blue-500/40 transition-all duration-300 shadow-xs">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/10 transition-all" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Active Delivery Projects
                    </CardTitle>
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        <FolderKanban className="h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent className="pt-2">
                    <div className="text-3xl font-bold text-foreground tracking-tight font-mono">
                        {data.activeProjectsCount}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        <span className="font-medium text-blue-600 dark:text-blue-400">{data.taskCompletionRate}%</span> milestone delivery rate
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
