"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Compass } from "lucide-react";

interface LeadSourceBarChartProps {
    data: Array<{
        name: string;
        total: number;
        won: number;
    }>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-zinc-950/90 border border-zinc-800 p-2.5 rounded-lg shadow-xl backdrop-blur-md text-xs space-y-1">
                <p className="font-semibold text-zinc-200">{label}</p>
                <p className="text-indigo-400">Total Inquiries: <span className="font-bold">{payload[0]?.value || 0}</span></p>
                <p className="text-emerald-400">Deals Won: <span className="font-bold">{payload[1]?.value || 0}</span></p>
            </div>
        );
    }
    return null;
};

export function LeadSourceBarChart({ data }: LeadSourceBarChartProps) {
    return (
        <Card className="bg-black/40 border-white/10 backdrop-blur-md relative overflow-hidden">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                    <Compass className="w-4 h-4 text-blue-400" />
                    Lead Acquisition Sources
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                    Inquiries and conversion breakdown by acquisition channel
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis
                                dataKey="name"
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
                            <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} name="Total Leads" />
                            <Bar dataKey="won" fill="#10b981" radius={[4, 4, 0, 0]} name="Deals Won" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
