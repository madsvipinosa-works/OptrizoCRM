"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";


interface LeadsData {
    status: string;
    score: number | null;
    budget: string | null;
    createdAt: Date;
    service: string | null;
}

interface AnalyticsChartsProps {
    totalLeads: number;
    leadsData: LeadsData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function AnalyticsCharts({ totalLeads, leadsData }: AnalyticsChartsProps) {

    // 1. Process Data: Leads by Status
    const statusCounts = leadsData.reduce((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const statusChartData = Object.keys(statusCounts).map(key => ({
        name: key,
        value: statusCounts[key]
    }));

    // 2. Process Data: Leads by Service
    const serviceCounts = leadsData.reduce((acc, lead) => {
        const service = lead.service || "Unspecified";
        acc[service] = (acc[service] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const serviceChartData = Object.keys(serviceCounts).map((key, index) => ({
        name: key,
        value: serviceCounts[key],
        color: COLORS[index % COLORS.length]
    }));

    // 3. Process Data: Average Score
    const avgScore = leadsData.length
        ? Math.round(leadsData.reduce((acc, lead) => acc + (lead.score || 0), 0) / leadsData.length)
        : 0;

    // 4. Calculate Conversion Rate (Completed / Total)
    const completedCount = leadsData.filter(l => l.status === "Completed").length;
    const conversionRate = totalLeads ? ((completedCount / totalLeads) * 100).toFixed(1) : "0";

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="glass-card border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalLeads}</div>
                    </CardContent>
                </Card>
                <Card className="glass-card border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Lead Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${avgScore > 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {avgScore}
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-400">{conversionRate}%</div>
                        <p className="text-xs text-muted-foreground">{completedCount} deals won</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="glass-card border-white/10 col-span-1">
                    <CardHeader>
                        <CardTitle>Pipeline Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={statusChartData}>
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Bar dataKey="value" fill="#adfa1d" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10 col-span-1">
                    <CardHeader>
                        <CardTitle>Leads by Service</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={serviceChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {serviceChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
