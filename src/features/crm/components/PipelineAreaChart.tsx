"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Activity } from "lucide-react";

interface PipelineAreaChartProps {
    data: Array<{
        date: string;
        leads: number;
        won: number;
        value: number;
    }>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-card/95 border border-border p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1.5 text-foreground">
                <p className="font-mono text-[11px] font-semibold text-foreground border-b border-border pb-1">{label}</p>
                <div className="flex items-center justify-between gap-4 text-emerald-500">
                    <span className="text-muted-foreground">Inbound Leads:</span>
                    <span className="font-bold font-mono">{payload[0]?.value || 0}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-primary">
                    <span className="text-muted-foreground">Deals Won:</span>
                    <span className="font-bold font-mono">{payload[1]?.value || 0}</span>
                </div>
            </div>
        );
    }
    return null;
};

export function PipelineAreaChart({ data }: PipelineAreaChartProps) {
    return (
        <Card className="glass-card border-border shadow-xs relative overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            Revenue & Lead Velocity
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground mt-1">
                            Inbound lead volume vs. deals won over the past 30 days
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span className="text-muted-foreground font-mono text-[11px]">Inbound Leads</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                            <span className="text-muted-foreground font-mono text-[11px]">Closed Won</span>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00D639" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="#00D639" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#71717a"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#71717a"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="leads"
                                stroke="#10b981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorLeads)"
                            />
                            <Area
                                type="monotone"
                                dataKey="won"
                                stroke="#00D639"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorWon)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
