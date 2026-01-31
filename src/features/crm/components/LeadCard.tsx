"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Mail, Clock, DollarSign, Activity, Pencil, Briefcase, Plus } from "lucide-react";
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
import { updateLead, addLeadNote } from "@/features/crm/actions";
import { ScrollArea } from "@/components/ui/scroll-area";

// Define the shape of our Lead based on the schema
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
    read: boolean;
    assignee: { id: string; name: string | null; image: string | null } | null;
    notesList?: {
        id: string;
        content: string;
        createdAt: Date;
        author: { name: string | null; email: string } | null;
    }[];
};

// Colors for different statuses
const statusColors: Record<string, string> = {
    "New": "bg-primary text-black hover:bg-primary/80",
    "Contacted": "bg-blue-500 text-white hover:bg-blue-600",
    "In Progress": "bg-yellow-500 text-black hover:bg-yellow-600",
    "Completed": "bg-green-500 text-white hover:bg-green-600",
    "Lost": "bg-gray-500 text-white hover:bg-gray-600",
};

export function LeadCard({ lead, assignableUsers }: { lead: Lead; assignableUsers: { id: string; name: string | null; image: string | null }[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState(lead.status);
    const [assignedTo, setAssignedTo] = useState(lead.assignee?.id || "");
    const [newNote, setNewNote] = useState("");

    const handleSaveStatus = async () => {
        setIsLoading(true);
        try {
            const result = await updateLead(lead.id, { status });
            if (result.success) {
                // Keep dialog open, just update UI feedback
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAssign = async (userId: string) => {
        setIsLoading(true);
        try {
            const result = await updateLead(lead.id, { assignedTo: userId || null });
            if (result.success) {
                setAssignedTo(userId);
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
            const result = await addLeadNote(lead.id, newNote);
            if (result.success) {
                setNewNote("");
                // Notes list updates via Server Action revalidation
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="glass-card border-white/5 transition-all hover:bg-white/5 flex flex-col justify-between h-full">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                            {lead.name}
                            <Badge className={statusColors[lead.status] || "bg-secondary"}>
                                {lead.status}
                            </Badge>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {lead.email}
                        </CardDescription>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(lead.createdAt), "MMM d")}
                        </div>
                        {lead.assignee && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1 border-white/20">
                                {lead.assignee.name || "Assigned"}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 py-4 flex-grow">
                <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">Project Details</span>
                    {lead.subject && (
                        <p className="text-sm font-semibold text-white mb-1">
                            {lead.subject}
                        </p>
                    )}
                    <p className="text-sm text-gray-400 line-clamp-3">
                        {lead.message}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                    {lead.service && (
                        <Badge variant="outline" className="border-white/10 flex gap-1 items-center">
                            <Briefcase className="h-3 w-3" /> {lead.service}
                        </Badge>
                    )}
                    {lead.budget && (
                        <Badge variant="outline" className="border-white/10 flex gap-1 items-center">
                            <DollarSign className="h-3 w-3" /> {lead.budget}
                        </Badge>
                    )}
                    {(lead.score || 0) > 0 && (
                        <Badge variant="outline" className={`border-white/10 flex gap-1 items-center ${(lead.score || 0) > 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                            <Activity className="h-3 w-3" /> Score: {lead.score}
                        </Badge>
                    )}
                </div>

                {/* Display Latest Note Preview */}
                {lead.notesList && lead.notesList.length > 0 && (
                    <div className="bg-white/5 p-2 rounded-md border-l-2 border-yellow-500/50">
                        <p className="text-xs text-muted-foreground line-clamp-2 italic">
                            &quot;{lead.notesList[0].content}&quot;
                        </p>
                        <div className="mt-1 text-[10px] text-gray-500 flex justify-end">
                            - {lead.notesList[0].author?.name || "Admin"}
                        </div>
                    </div>
                )}
            </CardContent>

            <CardFooter className="pt-2 border-t border-white/5 flex justify-between items-center text-xs text-muted-foreground">
                <span>Source: {lead.source || "Direct"}</span>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 hover:bg-white/10">
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Manage
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-card border-white/10 text-white max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Manage Lead: {lead.name}</DialogTitle>
                            <DialogDescription>
                                Update pipeline status and assign tasks.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                            {/* Left Column: Actions */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="status">Pipeline Stage</Label>
                                    <select
                                        id="status"
                                        value={status}
                                        onChange={async (e) => {
                                            setStatus(e.target.value as Lead['status']);
                                        }}
                                        className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <option value="New">New</option>
                                        <option value="Contacted">Contacted</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Lost">Lost</option>
                                    </select>
                                    <Button onClick={handleSaveStatus} disabled={isLoading} size="sm" className="w-full bg-primary text-black hover:bg-primary/90">
                                        Update Status
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="assignee">Assign To</Label>
                                    <select
                                        id="assignee"
                                        value={assignedTo}
                                        onChange={(e) => handleAssign(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        disabled={isLoading}
                                    >
                                        <option value="">Unassigned</option>
                                        {assignableUsers.map(user => (
                                            <option key={user.id} value={user.id}>
                                                {user.name || "User"}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Add Internal Note</Label>
                                    <Textarea
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        placeholder="Call summary, requirements, etc."
                                        className="bg-black/50 border-white/10 min-h-[100px]"
                                    />
                                    <Button onClick={handleAddNote} disabled={isLoading || !newNote.trim()} size="sm" className="w-full bg-primary text-black hover:bg-primary/90">
                                        <Plus className="h-4 w-4 mr-2" /> Add Note
                                    </Button>
                                </div>
                            </div>

                            {/* Right Column: Timeline */}
                            <div className="border border-white/10 rounded-md bg-black/20 p-4">
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-primary" /> Activity Log
                                </h3>
                                <ScrollArea className="h-[300px] pr-4">
                                    <div className="space-y-4">
                                        {lead.notesList?.map((note) => (
                                            <div key={note.id} className="text-sm relative pl-4 border-l border-white/10 pb-4 last:pb-0">
                                                <div className="absolute left-[-2.5px] top-1 h-1.5 w-1.5 rounded-full bg-primary" />
                                                <div className="flex justify-between items-start text-xs text-muted-foreground mb-1">
                                                    <span className="font-semibold text-white flex items-center gap-1">
                                                        {note.author?.name || "Unknown"}
                                                    </span>
                                                    <span>{format(new Date(note.createdAt), "MMM d, h:mm a")}</span>
                                                </div>
                                                <p className="text-gray-300 bg-white/5 p-2 rounded-md">
                                                    {note.content}
                                                </p>
                                            </div>
                                        ))}
                                        {(!lead.notesList || lead.notesList.length === 0) && (
                                            <p className="text-xs text-muted-foreground text-center py-8">
                                                No notes yet. Start the conversation!
                                            </p>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardFooter>
        </Card>
    );
}
