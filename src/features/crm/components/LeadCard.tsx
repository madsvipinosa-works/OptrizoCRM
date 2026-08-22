"use client";

import React from "react";
import { formatDistanceToNow } from "date-fns";
import {
    DollarSign,
    Building2,
    Clock,
    FileText,
    Flame,
    Zap,
    Snowflake,
    AlertTriangle,
    ExternalLink,
    Briefcase,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LeadItem } from "./LeadsDataTable";
import Link from "next/link";

interface LeadCardProps {
    lead: LeadItem;
    assignableUsers?: { id: string; name: string | null; image: string | null; jobTitle?: string | null; role?: string | null }[];
    isAdmin?: boolean;
    onSelect?: (lead: LeadItem) => void;
}

export function LeadCard({
    lead,
    onSelect,
}: LeadCardProps) {
    const leadTitle = lead.businessName || lead.contactName || lead.client?.name || "Unnamed Opportunity";
    const score = lead.leadScore ?? 50;
    const priority = lead.priority ?? (score >= 75 ? "Hot" : score < 45 ? "Cold" : "Warm");

    const lastContactTime = lead.lastContactedAt
        ? new Date(lead.lastContactedAt)
        : lead.updatedAt
        ? new Date(lead.updatedAt)
        : new Date(lead.createdAt);

    const daysSinceContact = Math.floor((Date.now() - lastContactTime.getTime()) / (1000 * 3600 * 24));
    const isStale = !["Closed Won", "Closed Lost"].includes(lead.status) && daysSinceContact >= 5;

    const getPriorityIcon = (p: string) => {
        if (p === "Hot") return <Flame className="h-3 w-3 text-rose-400" />;
        if (p === "Cold") return <Snowflake className="h-3 w-3 text-cyan-400" />;
        return <Zap className="h-3 w-3 text-amber-400" />;
    };

    const getPriorityBadgeClass = (p: string) => {
        if (p === "Hot") return "bg-rose-500/10 text-rose-400 border-rose-500/20";
        if (p === "Cold") return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    };

    return (
        <div
            onClick={() => onSelect?.(lead)}
            className={`group relative rounded-xl border bg-zinc-950/90 hover:bg-zinc-900/90 transition-all duration-200 p-3.5 space-y-3 cursor-pointer shadow-md hover:shadow-xl hover:border-white/20 select-none ${
                isStale
                    ? "border-l-4 border-l-amber-500 border-white/10"
                    : "border-white/10"
            }`}
        >
            {/* Top Row: Company Name & Priority / Score */}
            <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                    <h4 className="font-semibold text-sm text-white group-hover:text-primary transition-colors truncate">
                        {leadTitle}
                    </h4>
                    {lead.contactEmail && (
                        <p className="text-[11px] text-zinc-400 truncate">
                            {lead.contactEmail}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0.5 gap-1 font-semibold ${getPriorityBadgeClass(priority)}`}
                    >
                        {getPriorityIcon(priority)} {priority}
                    </Badge>
                    <span className="text-[10px] font-mono text-zinc-500 font-bold bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                        {score}
                    </span>
                </div>
            </div>

            {/* Middle Row: Industry / Focus & Estimated Value */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                <div className="flex items-center gap-1.5 text-zinc-400 truncate max-w-[60%]">
                    <Building2 className="h-3 w-3 text-zinc-500 shrink-0" />
                    <span className="truncate">{lead.industry || "General Focus"}</span>
                </div>

                <div className="flex items-center gap-1 font-mono font-bold text-emerald-400 shrink-0">
                    <DollarSign className="h-3 w-3" />
                    {(lead.estimatedValue || 0).toLocaleString()}
                </div>
            </div>

            {/* Bottom Row: Assignee avatars, last activity relative time, SOW link */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-zinc-400">
                {/* Assignees avatar stack */}
                <div className="flex items-center gap-1.5">
                    {lead.assignees && lead.assignees.length > 0 ? (
                        <div className="flex -space-x-1.5 overflow-hidden">
                            {lead.assignees.slice(0, 3).map((assignee, idx) => (
                                <div
                                    key={idx}
                                    className="w-5 h-5 rounded-full bg-zinc-900 border border-white/20 text-primary flex items-center justify-center font-bold text-[9px]"
                                    title={assignee.name || "Staff"}
                                >
                                    {assignee.name?.[0]?.toUpperCase() || "U"}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <span className="text-zinc-600 italic text-[10px]">Unassigned</span>
                    )}

                    <span className="text-zinc-600">•</span>

                    {/* Relative Activity */}
                    <span
                        className={`flex items-center gap-1 ${
                            isStale ? "text-amber-400 font-semibold" : "text-zinc-500"
                        }`}
                    >
                        <Clock className="h-2.5 w-2.5" />
                        {isStale ? `${daysSinceContact}d idle` : formatDistanceToNow(lastContactTime, { addSuffix: true })}
                    </span>
                </div>

                {/* SOW Studio shortcut */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Link
                        href={`/dashboard/proposals/builder/${lead.id}`}
                        className="p-1 rounded bg-white/5 hover:bg-primary/20 text-zinc-400 hover:text-primary transition-colors"
                        title="Open Proposal Studio"
                    >
                        <FileText className="h-3.5 w-3.5" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
