"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateInquiryAssignment, updateInquiryNextAction, markInquiryHandled } from "@/features/inquiries/actions";
import { toast } from "sonner";
import { Check, User, Activity } from "lucide-react";
import { ConvertInquiryButton } from "@/features/crm/components/ConvertInquiryButton";

interface InquiryManagementFormProps {
    inquiry: {
        id: string;
        ownerId: string | null;
        owner?: { id: string; name: string | null } | null;
        nextAction: string | null;
        isHandled: boolean;
        status: string;
    };
    teamMembers: { id: string; name: string | null }[];
}

export function InquiryManagementForm({ inquiry, teamMembers }: InquiryManagementFormProps) {
    const [isPending, startTransition] = useTransition();
    const [nextAction, setNextAction] = useState(inquiry.nextAction || "");
    const [savedNextAction, setSavedNextAction] = useState(inquiry.nextAction || "");
    const [ownerId, setOwnerId] = useState(inquiry.ownerId || "unassigned");
    const [isHandled, setIsHandled] = useState(inquiry.isHandled || inquiry.status === "Archived");
    const router = useRouter();

    useEffect(() => {
        setNextAction(inquiry.nextAction || "");
        setSavedNextAction(inquiry.nextAction || "");
        setOwnerId(inquiry.ownerId || "unassigned");
        setIsHandled(inquiry.isHandled || inquiry.status === "Archived");
    }, [inquiry.nextAction, inquiry.ownerId, inquiry.isHandled, inquiry.status]);

    const handleAssign = (ownerId: string) => {
        startTransition(async () => {
            try {
                const result = await updateInquiryAssignment(inquiry.id, ownerId === "unassigned" ? null : ownerId);
                if (!result.success) throw new Error(result.message);
                setOwnerId(ownerId);
                toast.success("Assignment updated");
                router.refresh();
            } catch {
                toast.error("Failed to update assignment");
            }
        });
    };

    const handleSaveNextAction = () => {
        startTransition(async () => {
            try {
                const savedAction = nextAction.trim();
                const result = await updateInquiryNextAction(inquiry.id, savedAction);
                if (!result.success) throw new Error(result.message);
                setNextAction(savedAction);
                setSavedNextAction(savedAction);
                toast.success("Next action saved");
                router.refresh();
            } catch {
                toast.error("Failed to save next action");
            }
        });
    };

    const handleToggleHandled = () => {
        startTransition(async () => {
            try {
                const nextHandledState = !isHandled;
                const result = await markInquiryHandled(inquiry.id, nextHandledState);
                if (!result.success) throw new Error(result.message);
                setIsHandled(nextHandledState);
                toast.success(nextHandledState ? "Inquiry marked as handled" : "Inquiry reopened");
                router.refresh();
            } catch {
                toast.error("Failed to update handled status");
            }
        });
    };

    return (
        <div className="space-y-4 pt-4 border-t border-border mt-4">
            <h4 className="text-sm font-medium text-foreground uppercase tracking-wider mb-2">Internal Management</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" /> Assign To
                    </label>
                    <Select value={ownerId} onValueChange={handleAssign} disabled={isPending}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Assign owner..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {inquiry.ownerId && !teamMembers.some((member) => member.id === inquiry.ownerId) && (
                                <SelectItem value={inquiry.ownerId} disabled>
                                    {inquiry.owner?.name || "Former or inactive owner"}
                                </SelectItem>
                            )}
                            {teamMembers.map(member => (
                                <SelectItem key={member.id} value={member.id}>
                                    {member.name || "Unknown User"}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Next Action
                    </label>
                    <div className="flex gap-2">
                        <Textarea 
                            value={nextAction} 
                            onChange={(e) => setNextAction(e.target.value)} 
                            placeholder="e.g. Call back on Tuesday..." 
                            className="min-h-[40px] h-[40px]" 
                            disabled={isPending}
                        />
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={handleSaveNextAction} 
                            disabled={isPending || nextAction.trim() === savedNextAction.trim()}
                            className="h-[40px]"
                        >
                            Save
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-border mt-4">
                <div className="space-y-1">
                    <Button
                        variant={isHandled ? "outline" : "default"}
                        onClick={handleToggleHandled}
                        disabled={isPending || inquiry.status === "Archived"}
                        className={isHandled ? "text-muted-foreground" : "bg-green-600 hover:bg-green-700 text-white"}
                    >
                        <Check className="w-4 h-4 mr-2" />
                        {inquiry.status === "Archived" ? "Converted / archived" : isHandled ? "Reopen inquiry" : "Mark as handled"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        {inquiry.status === "Archived"
                            ? "This inquiry was converted to a lead and remains in the handled / converted tab."
                            : "Handled means no further action is currently needed. You can reopen it later."}
                    </p>
                </div>

                {inquiry.status !== "Archived" && (
                    <ConvertInquiryButton inquiryId={inquiry.id} />
                )}
            </div>
        </div>
    );
}
