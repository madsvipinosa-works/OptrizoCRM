"use client";

import { useState } from "react";
import { format, differenceInDays, formatDistanceToNow } from "date-fns";
import { Mail, Clock, DollarSign, Activity, Pencil, Briefcase, Plus, AlertTriangle, Upload, X, Copy, Check, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateLead, addLeadNote, markLeadAsWon } from "@/features/crm/actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import { ProposalBuilderModal } from "@/features/proposals/components/ProposalBuilderModal";
import { LeadArchiveButton } from "@/features/crm/components/LeadArchiveButton";
import AnimatedDropdown from "@/components/ui/animated-dropdown";
import { MultiAssigneeSelect } from "@/components/ui/multi-assignee-select";

function CopyLinkButton({ proposalId }: { proposalId: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        const url = `${window.location.origin}/proposal/${proposalId}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success("Link copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-muted-foreground hover:text-primary"
            onClick={handleCopy}
            title="Copy Proposal Link"
        >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
    );
}

function SendEmailButton({ proposalId }: { proposalId: string }) {
    const [sending, setSending] = useState(false);
    
    const handleSend = async () => {
        setSending(true);
        const { sendProposalEmail } = await import("@/features/proposals/actions");
        const res = await sendProposalEmail(proposalId);
        if (res.success) {
            toast.success("Proposal sent via email!");
        } else {
            toast.error(res.message);
        }
        setSending(false);
    };

    return (
        <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-muted-foreground hover:text-primary"
            onClick={handleSend}
            disabled={sending}
            title="Send Proposal via Email"
        >
            <Mail className="h-3 w-3" />
        </Button>
    );
}

function DeleteProposalButton({ proposalId }: { proposalId: string }) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this proposal?")) return;
        setIsDeleting(true);
        const { deleteProposal } = await import("@/features/proposals/actions");
        const res = await deleteProposal(proposalId);
        if (res.success) {
            toast.success("Proposal deleted.");
        } else {
            toast.error(res.message || "Delete failed");
        }
        setIsDeleting(false);
    };

    return (
        <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-muted-foreground hover:text-red-500"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete Proposal"
        >
            <Trash2 className="h-3 w-3" />
        </Button>
    );
}

// Define the shape of our Lead based on the schema
type Lead = {
    id: string;
    businessName: string | null;
    clientId: string;
    client?: { name: string | null; email: string };
    goals: string | null;
    status: string;
    industry?: string | null;
    budget: string | null;
    source: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    assignees?: { id: string; name: string | null; image: string | null; jobTitle?: string | null }[];
    activityLogs?: {
        id: string;
        content: string;
        activityType: string | null;
        createdAt: Date | string;
        author: { name: string | null; email: string } | null;
    }[];
    proposals?: {
        id: string;
        status: string;
        createdAt: Date | string;
    }[];
};

// Colors for different statuses
const STATUS_COLORS: Record<string, string> = {
    "Pending Approval": "bg-primary text-black hover:bg-primary/80",
    "In Review": "bg-blue-500 text-white hover:bg-blue-600",
    "Proposal Sent": "bg-yellow-500 text-black hover:bg-yellow-600",
    "Closed Won": "bg-green-500 text-white hover:bg-green-600",
    "Closed Lost": "bg-gray-500 text-white hover:bg-gray-600",
};

import { useRouter } from "next/navigation";

export function LeadCard({ lead, assignableUsers, isAdmin }: { lead: Lead; assignableUsers: { id: string; name: string | null; image: string | null; jobTitle?: string | null }[], isAdmin?: boolean }) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState(lead.status);
    const [assignedToIds, setAssignedToIds] = useState<string[]>(lead.assignees?.map(a => a.id) || []);
    const [newNote, setNewNote] = useState("");
    const [activityType, setActivityType] = useState<"Note" | "Email" | "Call" | "Meeting">("Note");

    // Stale Logic: older than 7 days and not in a terminal state
    const daysSinceUpdate = differenceInDays(new Date(), new Date(lead.updatedAt));
    const isStale = daysSinceUpdate > 7 && status !== "Closed Won" && status !== "Closed Lost";

    const lastUpdated = formatDistanceToNow(new Date(lead.updatedAt), { addSuffix: true });

    const handleSaveStatus = async () => {
        setIsLoading(true);
        try {
            if (status === "Closed Won" && lead.status !== "Closed Won") {
                const result = await markLeadAsWon(lead.id);
                if (result.success) {
                    toast.success("Lead Won! Client and Project Provisioned.", {
                        description: "Check client portal or PM dashboard for project status."
                    });
                    setIsOpen(false);
                    router.refresh();
                } else {
                    toast.error(result.message);
                }
            } else {
                const result = await updateLead(lead.id, {
                    status: status as "Pending Approval" | "In Review" | "Proposal Sent" | "Closed Won" | "Closed Lost"
                });
                if (result.success) {
                    toast.success("Lead status updated");
                    setIsOpen(false);
                    router.refresh();
                } else {
                    toast.error(result.message);
                }
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAssign = async (userIds: string[]) => {
        setIsLoading(true);
        try {
            const result = await updateLead(lead.id, { assigneeIds: userIds });
            if (result.success) {
                setAssignedToIds(userIds);
                router.refresh();
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddNote = async () => {
        if (!newNote.trim()) return;
        setIsLoading(true);
        try {
            const result = await addLeadNote(lead.id, newNote, activityType);
            if (result.success) {
                setNewNote("");
                toast.success(`${activityType} logged successfully`);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to add note");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className={cn(
            "glass-card transition-all hover:bg-white/5 flex flex-col justify-between h-full relative",
            isStale ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]" : "border-white/5"
        )}>
            {isStale && (
                <div className="absolute top-2 right-2 z-10">

                </div>
            )}
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-1">
                            {isStale && (
                                <Badge variant="destructive" className="h-5 text-[10px] px-1 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> Action Needed
                                </Badge>
                            )}
                        </div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            {lead.businessName || lead.client?.name || "Unknown Lead"}
                            <Badge className={STATUS_COLORS[lead.status] || "bg-secondary"}>
                                {lead.status}
                            </Badge>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {lead.client?.email || "No Email"}
                        </CardDescription>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1" title={`Created: ${format(new Date(lead.createdAt), "PP")}`}>
                            <Clock className="h-3 w-3" />
                            {lastUpdated}
                        </div>
                        {lead.assignees && lead.assignees.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 justify-end">
                                <div className="flex -space-x-1.5 mr-1">
                                    {lead.assignees.slice(0, 3).map((assignee, idx) => (
                                        <div key={idx} className="w-5 h-5 rounded-full bg-black border border-white/20 text-primary flex items-center justify-center font-bold text-[9px] z-10" title={assignee.name || "User"}>
                                            {assignee.name?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                    ))}
                                    {lead.assignees.length > 3 && (
                                        <div className="w-5 h-5 rounded-full bg-zinc-800 border border-white/20 text-muted-foreground flex items-center justify-center font-bold text-[8px] z-0">
                                            +{lead.assignees.length - 3}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 py-4 flex-grow">
                <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">Project Goals</span>
                    <p className="text-sm text-gray-400 line-clamp-3">
                        {lead.goals || "No goals provided."}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                    {lead.industry && (
                        <Badge variant="outline" className="border-white/10 flex gap-1 items-center">
                            <Briefcase className="h-3 w-3" /> {lead.industry}
                        </Badge>
                    )}
                    {lead.budget && (
                        <Badge variant="outline" className="border-white/10 flex gap-1 items-center">
                            <DollarSign className="h-3 w-3" /> {lead.budget}
                        </Badge>
                    )}
                </div>

                {/* Display Latest Note Preview */}
                {lead.activityLogs && lead.activityLogs.length > 0 && (
                    <div className="bg-white/5 p-2 rounded-md border-l-2 border-yellow-500/50">
                        <p className="text-xs text-muted-foreground line-clamp-2 italic">
                            &quot;{lead.activityLogs[0].content}&quot;
                        </p>
                        <div className="mt-1 text-[10px] text-gray-500 flex justify-end">
                            - {lead.activityLogs[0].author?.name || "System"}
                        </div>
                    </div>
                )}
            </CardContent>

            <CardFooter className="pt-2 border-t border-white/5 flex justify-between items-center text-xs text-muted-foreground">
                <span>Source: {lead.source || "Direct"}</span>

                <div className="flex gap-1.5 items-center">
                    {isAdmin && <LeadArchiveButton leadId={lead.id} />}
                    {isAdmin && (
                        <Dialog open={isOpen} onOpenChange={setIsOpen}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 hover:bg-white/10">
                                    <Pencil className="h-3.5 w-3.5 mr-2" />
                                    Manage
                                </Button>
                            </DialogTrigger>
                        <DialogContent className="glass-card border-white/10 text-white w-full max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
                            <DialogHeader>
                                <DialogTitle>Manage Lead: {lead.businessName || lead.client?.name}</DialogTitle>
                                <DialogDescription>
                                    Update pipeline status and assign tasks.
                                </DialogDescription>
                            </DialogHeader>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                            {/* Left Column: Actions */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="status">Pipeline Stage</Label>
                                    <AnimatedDropdown
                                        text={status}
                                        triggerClassName="flex h-10 w-full justify-between items-center rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        items={["Pending Approval", "In Review", "Proposal Sent", "Closed Won", "Closed Lost"].map(s => ({
                                            name: s,
                                            onClick: () => {
                                                const newStatus = s as Lead['status'];
                                                setStatus(newStatus);
                                                if (newStatus === "Closed Won" && lead.status !== "Closed Won") {
                                                    toast.info("Click 'Update Status' below to sequence the Project and Client Portal automation.");
                                                }
                                            }
                                        }))}
                                    />

                                    <Button onClick={handleSaveStatus} disabled={isLoading || status === lead.status} size="sm" className="w-full bg-primary text-black hover:bg-primary/90 mt-4">
                                        {isLoading ? "Updating..." : "Update Status & Schedule"}
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="assignee">Assign Team Members</Label>
                                    <MultiAssigneeSelect
                                        users={assignableUsers}
                                        selectedIds={assignedToIds}
                                        onSelectionChange={handleAssign}
                                    />
                                </div>

                                <div className="space-y-2 border-t border-white/10 pt-4">
                                    <Label>Proposal & Files</Label>
                                    <div className="bg-white/5 rounded-md p-3 border border-dashed border-white/20">
                                        <div className="mb-4">
                                            <ProposalBuilderModal leadId={lead.id} leadName={lead.businessName || "Client"} />
                                        </div>
                                        
                                        {lead.proposals && lead.proposals.length > 0 && (
                                            <div className="space-y-2 mb-4">
                                                {lead.proposals.map(p => (
                                                    <div key={p.id} className="flex flex-wrap gap-2 items-center justify-between text-xs bg-black/40 p-2 rounded border border-white/5">
                                                        <a href={`/proposal/${p.id}`} target="_blank" className="font-semibold text-white hover:text-primary transition-colors flex items-center shrink-0">
                                                            <FileText className="h-3 w-3 mr-2 text-primary" /> Web Proposal
                                                        </a>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <CopyLinkButton proposalId={p.id} />
                                                            <SendEmailButton proposalId={p.id} />
                                                            {p.status !== "Approved" && p.status !== "Accepted" && (
                                                                <>
                                                                    <ProposalBuilderModal leadId={lead.id} leadName={lead.businessName || "Client"} proposalId={p.id} />
                                                                    <DeleteProposalButton proposalId={p.id} />
                                                                </>
                                                            )}
                                                            <Badge variant="outline" className={`text-[10px] h-4 ${p.status === 'Approved' ? 'border-green-500 text-green-500' : p.status === 'Sent' ? 'border-yellow-500 text-yellow-500' : 'border-white/20'}`}>
                                                                {p.status}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}


                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Timeline */}
                            <div className="border border-white/10 rounded-md bg-black/20 p-4">
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-primary" /> Activity Log
                                </h3>
                                <ScrollArea className="h-[400px] pr-4">
                                    <div className="space-y-4">
                                        {lead.activityLogs?.map((note) => (
                                            <div key={note.id} className="text-sm relative pl-4 border-l border-white/10 pb-4 last:pb-0">
                                                <div className="absolute left-[-2.5px] top-1 h-1.5 w-1.5 rounded-full bg-primary" />
                                                <div className="flex justify-between items-start text-xs text-muted-foreground mb-1">
                                                    <span className="font-semibold text-white flex items-center gap-2">
                                                        {note.author?.name || "System"}
                                                        <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 leading-none">
                                                            {note.activityType || "Note"}
                                                        </Badge>
                                                    </span>
                                                    <span>{format(new Date(note.createdAt), "MMM d, h:mm a")}</span>
                                                </div>
                                                <p className="text-gray-300 bg-white/5 p-2 rounded-md">
                                                    {note.content}
                                                </p>
                                            </div>
                                        ))}
                                        {(!lead.activityLogs || lead.activityLogs.length === 0) && (
                                            <p className="text-xs text-muted-foreground text-center py-8">
                                                No activity logs yet. Start the conversation!
                                            </p>
                                        )}
                                    </div>
                                </ScrollArea>

                                <div className="space-y-2 border-t border-white/10 pt-4 mt-2">
                                    <Label>New Note / Log Activity</Label>
                                    <div className="flex flex-col gap-2 mb-2">
                                        <AnimatedDropdown
                                            text={activityType}
                                            triggerClassName="flex h-9 w-[120px] justify-between items-center rounded-md border border-white/10 bg-black/50 px-3 py-1 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            items={["Note", "Call", "Email", "Meeting"].map(type => ({
                                                name: type,
                                                onClick: () => setActivityType(type as "Note" | "Call" | "Email" | "Meeting")
                                            }))}
                                        />
                                        <Textarea
                                            value={newNote}
                                            onChange={(e) => setNewNote(e.target.value)}
                                            placeholder="Call summary, requirements, etc."
                                            className="bg-black/50 border-white/10 min-h-[80px]"
                                        />
                                        <Button onClick={handleAddNote} disabled={isLoading || !newNote.trim()} size="sm" className="w-full bg-primary text-black hover:bg-primary/90 mt-1">
                                            <Plus className="h-4 w-4 mr-2" /> Log {activityType}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </DialogContent>
                        </Dialog>
                    )}
                </div>
            </CardFooter>
        </Card>
    );
}
