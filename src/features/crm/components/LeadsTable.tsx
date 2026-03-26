"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Briefcase, DollarSign, Building2 } from "lucide-react";
import { format } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { LeadCard } from "./LeadCard";

interface Lead {
    id: string;
    name: string;
    email: string;
    subject: string | null;
    status: string;
    industry?: string | null;
    scope?: string | null;
    budget?: string | null;
    service?: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    assignee: { name: string | null; image: string | null } | null;
}

interface LeadsTableProps {
    leads: Lead[];
    assignableUsers: { id: string; name: string | null; image: string | null }[];
}

export function LeadsTable({ leads, assignableUsers }: LeadsTableProps) {
    if (leads.length === 0) return null;

    return (
        <div className="rounded-md border border-white/10 bg-black/20 overflow-hidden">
            <Table>
                <TableHeader className="bg-white/5">
                    <TableRow className="hover:bg-transparent border-white/10">
                        <TableHead className="w-[200px]">Lead / Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Industry / Service</TableHead>
                        <TableHead>Budget / Scope</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead className="text-right">Created</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {leads.map((lead) => (
                        <Dialog key={lead.id}>
                            <DialogTrigger asChild>
                                <TableRow className="cursor-pointer hover:bg-white/5 border-white/10 transition-colors group">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-white group-hover:text-primary transition-colors">{lead.name}</span>
                                            <span className="text-xs text-muted-foreground">{lead.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={getStatusColor(lead.status)}>
                                            {lead.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            {lead.industry && (
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Building2 className="h-3 w-3" /> {lead.industry}
                                                </div>
                                            )}
                                            {lead.service && (
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Briefcase className="h-3 w-3" /> {lead.service}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            {lead.budget && (
                                                <div className="flex items-center gap-1 text-xs text-green-400 font-medium">
                                                    <DollarSign className="h-3 w-3" /> {lead.budget}
                                                </div>
                                            )}
                                            {lead.scope && (
                                                <div className="text-[10px] text-muted-foreground max-w-[150px] truncate">
                                                    {lead.scope}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {lead.assignee ? (
                                            <div className="flex items-center gap-2 text-xs">
                                                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary font-bold">
                                                    {lead.assignee.name?.[0] || "U"}
                                                </div>
                                                <span className="text-muted-foreground">{lead.assignee.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground/50 italic">Unassigned</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(lead.createdAt), "MMM d, yyyy")}
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl bg-black/90 border-white/10 p-0 overflow-hidden outline-none">
                                <DialogHeader className="sr-only">
                                    <DialogTitle>Lead Details: {lead.name}</DialogTitle>
                                    <DialogDescription>
                                        Detailed view of lead information and project scope.
                                    </DialogDescription>
                                </DialogHeader>
                                <LeadCard lead={lead as unknown as React.ComponentProps<typeof LeadCard>['lead']} assignableUsers={assignableUsers} />
                            </DialogContent>
                        </Dialog>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function getStatusColor(status: string) {
    switch (status) {
        case "New Inquiry": return "bg-blue-500/10 text-blue-400 border-blue-500/50";
        case "Qualified": return "bg-purple-500/10 text-purple-400 border-purple-500/50";
        case "Proposal Sent": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/50";
        case "Negotiation": return "bg-orange-500/10 text-orange-400 border-orange-500/50";
        case "Won": return "bg-green-500/10 text-green-400 border-green-500/50";
        case "Lost": return "bg-gray-500/10 text-gray-400 border-gray-500/50";
        default: return "bg-white/5 text-muted-foreground border-white/10";
    }
}
