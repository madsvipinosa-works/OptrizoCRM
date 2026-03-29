"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie,
    AreaChart, Area
} from "recharts";

interface ChartProps {
    pipelineData: { name: string; value: number; fill: string }[];
    sourceData: { name: string; value: number; fill: string }[];
    trendData: { date: string; count: number }[];
}

export function PipelineChart({ data }: { data: ChartProps['pipelineData'] }) {
    return (
        <Card className="bg-[#121212] border-[#262626] rounded-[1rem] col-span-2">
            <CardHeader>
                <CardTitle>Pipeline Distribution</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                            <XAxis type="number" stroke="#888" />
                            <YAxis dataKey="name" type="category" stroke="#888" width={80} />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }}
                                itemStyle={{ color: "#fff" }}
                                cursor={{ fill: 'transparent' }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

export function SourceChart({ data }: { data: ChartProps['sourceData'] }) {
    return (
        <Card className="bg-[#121212] border-[#262626] rounded-[1rem]">
            <CardHeader>
                <CardTitle>Lead Sources</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(0,0,0,0.5)" />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }}
                                itemStyle={{ color: "#fff" }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                        {data.map((entry, index) => (
                            <div key={index} className="flex items-center gap-1 text-xs text-muted-foreground">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                                {entry.name}
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function TrendChart({ data }: { data: ChartProps['trendData'] }) {
    return (
        <Card className="bg-[#121212] border-[#262626] rounded-[1rem] col-span-3">
            <CardHeader>
                <CardTitle>Lead Volume (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }}
                                itemStyle={{ color: "#fff" }}
                            />
                            <Area type="monotone" dataKey="count" stroke="#22c55e" fillOpacity={1} fill="url(#colorCount)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
