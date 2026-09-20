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
            <div className="bg-card/95 border border-border p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1.5 text-foreground">
                <p className="font-mono text-[11px] font-semibold text-foreground border-b border-border pb-1">{label}</p>
                <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Total Inquiries:</span>
                    <span className="font-bold font-mono text-emerald-500">{payload[0]?.value || 0}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Deals Won:</span>
                    <span className="font-bold font-mono text-primary">{payload[1]?.value || 0}</span>
                </div>
            </div>
        );
    }
    return null;
};

export function LeadSourceBarChart({ data }: LeadSourceBarChartProps) {
    return (
        <Card className="glass-card border-border shadow-xs relative overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/50">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Compass className="w-4 h-4 text-primary" />
                    Lead Acquisition Sources
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                    Inquiries and conversion breakdown by acquisition channel
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
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
                            <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} name="Total Leads" />
                            <Bar dataKey="won" fill="#00D639" radius={[4, 4, 0, 0]} name="Deals Won" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
