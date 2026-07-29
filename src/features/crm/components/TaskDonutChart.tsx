"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { PieChartIcon } from "lucide-react";

interface TaskDonutChartProps {
    data: Array<{
        name: string;
        value: number;
        fill: string;
    }>;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const item = payload[0];
        return (
            <div className="bg-zinc-950/90 border border-zinc-800 p-2.5 rounded-lg shadow-xl backdrop-blur-md text-xs">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.payload.fill }} />
                    <span className="font-semibold text-zinc-200">{item.name}:</span>
                    <span className="font-bold text-white">{item.value} tasks</span>
                </div>
            </div>
        );
    }
    return null;
};

export function TaskDonutChart({ data }: TaskDonutChartProps) {
    const totalTasks = data.reduce((acc, curr) => acc + curr.value, 0);

    return (
        <Card className="bg-black/40 border-white/10 backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-amber-400" />
                    Task Delivery Load
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                    Distribution across all active project Kanban boards
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
                <div className="h-[200px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={80}
                                paddingAngle={4}
                                dataKey="value"
                                stroke="none"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Centered label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-white">{totalTasks}</span>
                        <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Total Tasks</span>
                    </div>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 mt-2 text-xs">
                    {data.map((item) => (
                        <div key={item.name} className="flex items-center justify-between p-1.5 rounded-md bg-white/5">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                                <span className="text-zinc-300 font-medium text-[11px]">{item.name}</span>
                            </div>
                            <span className="font-semibold text-white text-[11px]">{item.value}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
