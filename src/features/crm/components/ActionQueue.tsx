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
        <Card className="glass-card border-border shadow-xs relative overflow-hidden flex flex-col h-full">
            <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold text-foreground">
                                Action Required Queue
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                High-priority operational bottlenecks requiring staff attention
                            </CardDescription>
                        </div>
                    </div>
                    {items.length > 0 && (
                        <Badge variant="outline" className="bg-rose-500/10 border-rose-500/30 text-rose-500 font-mono text-xs">
                            {items.length} Issue{items.length === 1 ? "" : "s"}
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="pt-3 flex-1 overflow-y-auto max-h-[380px] space-y-2.5 pr-2">
                {items.length === 0 ? (
                    <div className="py-12 text-center space-y-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 mx-auto flex items-center justify-center">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">All Operations Clear</p>
                        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                            No blocked tasks, pending client approvals, or stale leads requiring immediate action.
                        </p>
                    </div>
                ) : (
                    items.map((item) => {
                        let bgClass = "bg-muted/40 border-border/60 hover:border-primary/40 hover:bg-muted/60";
                        let badgeColor = "bg-primary/10 text-primary border-primary/20";
                        let IconComponent = Clock;
                        let iconColor = "text-primary";

                        if (item.urgency === "high") {
                            bgClass = "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40 hover:bg-rose-500/10";
                            badgeColor = "bg-rose-500/10 text-rose-500 border-rose-500/30";
                            IconComponent = AlertOctagon;
                            iconColor = "text-rose-500";
                        } else if (item.urgency === "medium") {
                            bgClass = "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/10";
                            badgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/30";
                            IconComponent = FileText;
                            iconColor = "text-amber-500";
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
                                            <IconComponent className={`w-4 h-4 ${iconColor}`} />
                                        </div>
                                        <div className="space-y-0.5">
                                            <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                                                {item.title}
                                            </h4>
                                            <p className="text-[11px] text-muted-foreground line-clamp-1">
                                                {item.subtitle}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Badge variant="outline" className={`text-[10px] uppercase font-mono font-semibold tracking-wider ${badgeColor}`}>
                                            {item.badgeText}
                                        </Badge>
                                        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
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
