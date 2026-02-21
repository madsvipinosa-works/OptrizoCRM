"use client";

import { useState } from "react";
import { LeadCard } from "./LeadCard"; // Ensure this matches export
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Users } from "lucide-react";

// Define the shape of our Lead based on strict schema alignment
// This should ideally be imported from a shared type file, but for now we mirror LeadCard
type Lead = {
    id: string;
    name: string;
    email: string;
    subject: string | null;
    message: string;
    status: "New" | "Contacted" | "In Progress" | "Completed" | "Lost";
    score: number | null;
    budget: string | null;
    service: string | null;
    source: string | null;
    notes: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    read: boolean;
    files: string[] | null;
    nextActionDate: Date | string | null;
    assignee: { id: string; name: string | null; image: string | null } | null;
    notesList?: {
        id: string;
        content: string;
        activityType: "Call" | "Email" | "Meeting" | "Note";
        createdAt: Date;
        author: { name: string | null; email: string } | null;
    }[];
};

interface LeadsBoardProps {
    leads: Lead[];
    assignableUsers: { id: string; name: string | null; image: string | null }[];
    currentUserId: string;
    query?: string;
    status?: string;
}

export function LeadsBoard({ leads, assignableUsers, currentUserId, query, status }: LeadsBoardProps) {
    const [viewMode, setViewMode] = useState<"all" | "mine">("all");

    // Filter leads based on viewMode
    const displayedLeads = leads.filter(lead => {
        if (viewMode === "mine") {
            return lead.assignee?.id === currentUserId;
        }
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "all" | "mine")}>
                    <TabsList className="bg-white/5 border border-white/10">
                        <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-black">
                            <Users className="h-4 w-4 mr-2" /> All Leads
                        </TabsTrigger>
                        <TabsTrigger value="mine" className="data-[state=active]:bg-primary data-[state=active]:text-black">
                            <User className="h-4 w-4 mr-2" /> My Leads
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="text-sm text-muted-foreground">
                    Showing {displayedLeads.length} leads
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {displayedLeads.length === 0 ? (
                    <div className="col-span-full p-12 text-center border border-dashed border-white/10 rounded-lg text-muted-foreground bg-white/5">
                        {viewMode === "mine"
                            ? "You don't have any assigned leads yet."
                            : (query || status ? "No leads found matching your filters." : "No leads yet.")}
                    </div>
                ) : (
                    displayedLeads.map((lead) => (
                        <LeadCard
                            key={lead.id}
                            lead={lead}
                            assignableUsers={assignableUsers}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
