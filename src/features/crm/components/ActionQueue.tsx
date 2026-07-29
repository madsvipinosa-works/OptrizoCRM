"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ArrowUpRight, AlertOctagon, FileText, Clock, CheckCircle } from "lucide-react";

interface ActionItem {
    id: string;
    type: "blocked_task" | "pending_proposal" | "stale_lead";
    title: string;
    subtitle: string;
    urgency: "high" | "medium" | "low";
    link: string;
    badgeText: string;
    createdAt: string;
}

interface ActionQueueProps {
    items: ActionItem[];
}

export function ActionQueue({ items }: ActionQueueProps) {
    return (
        <Card className="bg-black/40 border-white/10 backdrop-blur-md relative overflow-hidden flex flex-col h-full">
            <CardHeader className="pb-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold text-white">
                                Action Required Queue
                            </CardTitle>
                            <CardDescription className="text-xs text-zinc-400">
                                High-priority operational bottlenecks requiring staff attention
                            </CardDescription>
                        </div>
                    </div>
                    {items.length > 0 && (
                        <Badge variant="outline" className="bg-rose-500/10 border-rose-500/30 text-rose-400 font-mono text-xs">
                            {items.length} Issue{items.length === 1 ? "" : "s"}
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="pt-3 flex-1 overflow-y-auto max-h-[380px] space-y-2.5 pr-2">
                {items.length === 0 ? (
                    <div className="py-12 text-center space-y-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-semibold text-zinc-200">All Operations Clear</p>
                        <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                            No blocked tasks, pending client approvals, or stale leads requiring immediate action.
                        </p>
                    </div>
                ) : (
                    items.map((item) => {
                        let bgClass = "bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700";
                        let badgeColor = "bg-zinc-800 text-zinc-300 border-zinc-700";
                        let IconComponent = Clock;

                        if (item.urgency === "high") {
                            bgClass = "bg-rose-950/20 border-rose-900/40 hover:border-rose-500/40 hover:bg-rose-950/30";
                            badgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/30";
                            IconComponent = AlertOctagon;
                        } else if (item.urgency === "medium") {
                            bgClass = "bg-amber-950/20 border-amber-900/40 hover:border-amber-500/40 hover:bg-amber-950/30";
                            badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/30";
                            IconComponent = FileText;
                        } else {
                            bgClass = "bg-indigo-950/20 border-indigo-900/40 hover:border-indigo-500/40 hover:bg-indigo-950/30";
                            badgeColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
                            IconComponent = Clock;
                        }

                        return (
                            <Link
                                key={item.id}
                                href={item.link}
                                className={`block p-3 rounded-lg border transition-all duration-200 group relative ${bgClass}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5">
                                        <div className="mt-0.5 shrink-0">
                                            <IconComponent className={`w-4 h-4 ${item.urgency === "high" ? "text-rose-400" : item.urgency === "medium" ? "text-amber-400" : "text-indigo-400"}`} />
                                        </div>
                                        <div className="space-y-0.5">
                                            <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-white transition-colors">
                                                {item.title}
                                            </h4>
                                            <p className="text-[11px] text-zinc-400 line-clamp-1">
                                                {item.subtitle}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Badge variant="outline" className={`text-[10px] uppercase font-semibold tracking-wider ${badgeColor}`}>
                                            {item.badgeText}
                                        </Badge>
                                        <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
