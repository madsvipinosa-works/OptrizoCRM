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
            <div className="bg-zinc-950/90 border border-zinc-800 p-3 rounded-lg shadow-2xl backdrop-blur-md text-xs space-y-1.5">
                <p className="font-semibold text-zinc-200 border-b border-zinc-800/80 pb-1">{label}</p>
                <div className="flex items-center justify-between gap-4 text-indigo-400">
                    <span>Leads Created:</span>
                    <span className="font-bold">{payload[0]?.value || 0}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-emerald-400">
                    <span>Deals Won:</span>
                    <span className="font-bold">{payload[1]?.value || 0}</span>
                </div>
            </div>
        );
    }
    return null;
};

export function PipelineAreaChart({ data }: PipelineAreaChartProps) {
    return (
        <Card className="bg-black/40 border-white/10 backdrop-blur-md relative overflow-hidden">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                            <Activity className="w-4 h-4 text-indigo-400" />
                            Revenue & Lead Velocity
                        </CardTitle>
                        <CardDescription className="text-xs text-zinc-400 mt-1">
                            Inbound lead volume vs. deals won over the past 30 days
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                            <span className="text-zinc-400">Inbound Leads</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span className="text-zinc-400">Closed Won</span>
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
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
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
                                stroke="#6366f1"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorLeads)"
                            />
                            <Area
                                type="monotone"
                                dataKey="won"
                                stroke="#10b981"
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
