"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createLead } from "@/features/crm/actions";
import { DEFAULT_CRM_PLAYBOOK, PlaybookTaskTemplate } from "@/config/crm-playbook";
import { toast } from "sonner";
import { Plus, UserPlus, Loader2, UserCheck, Zap, ChevronDown, ChevronUp, Trash2, Clock, CheckSquare } from "lucide-react";

const LEAD_SOURCES = [
    "Website Form",
    "LinkedIn",
    "Referral",
    "Cold Outreach (Email/Call)",
    "Networking / Event",
    "Existing Client (Upsell)",
    "Other"
];

interface AssignableUser {
    id: string;
    name: string | null;
    image?: string | null;
    role?: string | null;
    jobTitle?: string | null;
}

interface CreateLeadModalProps {
    children?: React.ReactNode;
    assignableUsers?: AssignableUser[];
}

export function CreateLeadModal({ children, assignableUsers = [] }: CreateLeadModalProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Rep Assignment
    const [assignedRepId, setAssignedRepId] = useState<string>("auto");

    // Playbook tasks customization
    const [enablePlaybook, setEnablePlaybook] = useState<boolean>(true);
    const [showPlaybookAccordion, setShowPlaybookAccordion] = useState<boolean>(false);
    const [playbookTasks, setPlaybookTasks] = useState<PlaybookTaskTemplate[]>(() =>
        DEFAULT_CRM_PLAYBOOK.defaultTasks.map(t => ({ ...t }))
    );

    // New custom task inline input
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskType, setNewTaskType] = useState<"Call" | "Email" | "Meeting" | "To-do">("To-do");
    const [newTaskHours, setNewTaskHours] = useState<number>(48);

    const handleAddPlaybookTask = () => {
        if (!newTaskTitle.trim()) return;
        setPlaybookTasks((prev) => [
            ...prev,
            {
                title: newTaskTitle.trim(),
                taskType: newTaskType,
                priority: "Medium",
                dueHours: newTaskHours || 24,
            },
        ]);
        setNewTaskTitle("");
    };

    const handleRemovePlaybookTask = (index: number) => {
        setPlaybookTasks((prev) => prev.filter((_, i) => i !== index));
    };

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        const formData = new FormData(e.currentTarget);

        const businessName = formData.get("businessName") as string;
        const contactName = formData.get("contactName") as string;
        const contactEmail = formData.get("contactEmail") as string;
        const contactPhone = formData.get("contactPhone") as string;
        const source = formData.get("source") as string;
        const industry = formData.get("industry") as string;
        const budget = formData.get("budget") as string;
        const goals = formData.get("goals") as string;
        const timelineExpectation = formData.get("timeline") as string;

        const res = await createLead({
            businessName: businessName || contactName,
            contactName: contactName || undefined,
            contactEmail,
            contactPhone: contactPhone || undefined,
            industry: industry || undefined,
            source: source || "Manual Entry",
            budget: budget || undefined,
            timelineExpectation: timelineExpectation || undefined,
            goals: goals || undefined,
            assignedRepId: assignedRepId,
            tasksPlaybook: enablePlaybook ? playbookTasks : [],
        });

        setIsLoading(false);

        if (res.success) {
            toast.success(res.message || "Opportunity created successfully");
            setOpen(false);
            // Reset to defaults
            setPlaybookTasks(DEFAULT_CRM_PLAYBOOK.defaultTasks.map(t => ({ ...t })));
            setAssignedRepId("auto");
        } else {
            toast.error(res.message || "Failed to create opportunity");
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button className="bg-primary text-black hover:bg-primary/90 font-semibold gap-1.5 shadow-lg shadow-primary/20">
                        <Plus className="h-4 w-4" /> New Opportunity
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto bg-card border-border text-foreground shadow-2xl rounded-xl">
                <DialogHeader className="space-y-1">
                    <div className="flex items-center gap-2 text-primary text-xs font-semibold">
                        <UserPlus className="h-4 w-4" /> CRM Pipeline Intake
                    </div>
                    <DialogTitle className="text-xl font-bold text-foreground">Add New Deal / Lead</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Create a qualified sales opportunity directly in the pipeline with automated scoring and playbooks.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={onSubmit} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="businessName" className="text-xs font-medium text-foreground">Company / Business <span className="text-primary">*</span></Label>
                            <Input
                                id="businessName"
                                name="businessName"
                                placeholder="Acme Studios"
                                required
                                className="bg-muted/30 border-border text-foreground text-xs h-9 placeholder:text-muted-foreground focus:border-primary"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="contactName" className="text-xs font-medium text-foreground">Contact Person</Label>
                            <Input
                                id="contactName"
                                name="contactName"
                                placeholder="John Doe"
                                className="bg-muted/30 border-border text-foreground text-xs h-9 placeholder:text-muted-foreground focus:border-primary"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="contactEmail" className="text-xs font-medium text-foreground">Contact Email <span className="text-primary">*</span></Label>
                            <Input
                                id="contactEmail"
                                name="contactEmail"
                                type="email"
                                placeholder="john@acme.com"
                                required
                                className="bg-muted/30 border-border text-foreground text-xs h-9 placeholder:text-muted-foreground focus:border-primary"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="contactPhone" className="text-xs font-medium text-foreground">Phone Number</Label>
                            <Input
                                id="contactPhone"
                                name="contactPhone"
                                type="tel"
                                placeholder="+1 555-0192"
                                className="bg-muted/30 border-border text-foreground text-xs h-9 placeholder:text-muted-foreground focus:border-primary"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="budget" className="text-xs font-medium text-foreground">Budget / Value</Label>
                            <Input
                                id="budget"
                                name="budget"
                                placeholder="e.g. $10,000"
                                className="bg-muted/30 border-border text-foreground text-xs h-9 placeholder:text-muted-foreground focus:border-primary"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="source" className="text-xs font-medium text-foreground">Lead Source</Label>
                            <Select name="source" defaultValue="Website Form">
                                <SelectTrigger className="bg-muted/30 border-border text-xs h-9 text-foreground focus:border-primary">
                                    <SelectValue placeholder="Source" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground">
                                    {LEAD_SOURCES.map(source => (
                                        <SelectItem key={source} value={source} className="text-xs focus:bg-muted">{source}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="industry" className="text-xs font-medium text-foreground">Industry / Focus</Label>
                            <Input
                                id="industry"
                                name="industry"
                                placeholder="e.g. SaaS / Ecommerce"
                                className="bg-muted/30 border-border text-foreground text-xs h-9 placeholder:text-muted-foreground focus:border-primary"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="timeline" className="text-xs font-medium text-foreground">Timeline Urgency</Label>
                            <Input
                                id="timeline"
                                name="timeline"
                                placeholder="e.g. Immediate / 1 Month"
                                className="bg-muted/30 border-border text-foreground text-xs h-9 placeholder:text-muted-foreground focus:border-primary"
                            />
                        </div>
                    </div>

                    {/* Sales Rep Assignment */}
                    <div className="space-y-1.5 p-3 rounded-lg bg-muted/20 border border-border">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                <UserCheck className="h-3.5 w-3.5 text-primary" /> Sales Rep Assignment
                            </Label>
                            <span className="text-[10px] text-muted-foreground">Deal ownership</span>
                        </div>
                        <Select value={assignedRepId} onValueChange={setAssignedRepId}>
                            <SelectTrigger className="bg-muted/40 border-border text-xs h-9 text-foreground focus:border-primary">
                                <SelectValue placeholder="Select Assignee" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground">
                                <SelectItem value="auto" className="text-xs focus:bg-muted font-medium text-primary">
                                    ⚡ Auto-assign (Least busy sales rep / round-robin)
                                </SelectItem>
                                <SelectItem value="unassigned" className="text-xs focus:bg-muted text-muted-foreground">
                                    ⚪ Leave Unassigned
                                </SelectItem>
                                {assignableUsers.map((user) => (
                                    <SelectItem key={user.id} value={user.id} className="text-xs focus:bg-muted">
                                        👤 {user.name || "User"} {user.role ? `(${user.role})` : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Automated Sales Playbook Tasks Section */}
                    <div className="p-3 rounded-lg bg-muted/20 border border-border space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={enablePlaybook}
                                    onChange={(e) => setEnablePlaybook(e.target.checked)}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary accent-primary"
                                />
                                <div className="flex items-center gap-1.5">
                                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                                    <span className="text-xs font-semibold text-foreground">
                                        Auto-Provision Sales Playbook Tasks
                                    </span>
                                </div>
                            </label>

                            {enablePlaybook && (
                                <button
                                    type="button"
                                    onClick={() => setShowPlaybookAccordion(!showPlaybookAccordion)}
                                    className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                                >
                                    <span>{playbookTasks.length} task{playbookTasks.length === 1 ? "" : "s"}</span>
                                    {showPlaybookAccordion ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </button>
                            )}
                        </div>

                        {enablePlaybook && showPlaybookAccordion && (
                            <div className="pt-2 border-t border-border/60 space-y-2">
                                <p className="text-[11px] text-muted-foreground">
                                    These follow-up actions will automatically populate into the sales tasks queue for this deal:
                                </p>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                    {playbookTasks.map((task, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border text-xs"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                                                <span className="truncate font-medium text-foreground">{task.title}</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">
                                                    +{task.dueHours}h ({task.taskType})
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePlaybookTask(idx)}
                                                className="text-muted-foreground hover:text-rose-400 p-1 transition-colors"
                                                title="Remove Task"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                    {playbookTasks.length === 0 && (
                                        <div className="text-center py-2 text-xs text-muted-foreground italic">
                                            No automated tasks queued for this lead.
                                        </div>
                                    )}
                                </div>

                                {/* Add quick custom playbook task */}
                                <div className="flex items-center gap-1.5 pt-1">
                                    <Input
                                        placeholder="Add quick custom task..."
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                        className="h-7 text-xs bg-muted/30 border-border text-foreground py-0"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleAddPlaybookTask();
                                            }
                                        }}
                                    />
                                    <Select
                                        value={newTaskType}
                                        onValueChange={(val: any) => setNewTaskType(val)}
                                    >
                                        <SelectTrigger className="h-7 w-20 text-[11px] bg-muted/30 border-border py-0">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card border-border text-foreground">
                                            <SelectItem value="Call" className="text-xs">Call</SelectItem>
                                            <SelectItem value="Email" className="text-xs">Email</SelectItem>
                                            <SelectItem value="Meeting" className="text-xs">Meeting</SelectItem>
                                            <SelectItem value="To-do" className="text-xs">To-do</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                        <Input
                                            type="number"
                                            min={1}
                                            value={newTaskHours}
                                            onChange={(e) => setNewTaskHours(Number(e.target.value))}
                                            className="h-7 w-14 text-xs bg-muted/30 border-border text-foreground py-0 text-center"
                                            title="Due in hours"
                                        />
                                        <span className="text-[10px] text-muted-foreground">h</span>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleAddPlaybookTask}
                                        disabled={!newTaskTitle.trim()}
                                        className="h-7 px-2 text-xs bg-primary text-black font-semibold shrink-0"
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="goals" className="text-xs font-medium text-foreground">Project Goals / Notes</Label>
                        <Textarea
                            id="goals"
                            name="goals"
                            placeholder="Describe client requirements, objectives, or initial discovery notes..."
                            rows={2}
                            className="bg-muted/30 border-border text-foreground text-xs resize-none placeholder:text-muted-foreground focus:border-primary"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            className="text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="bg-primary text-black hover:bg-primary/90 font-semibold text-xs gap-1.5"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                                </>
                            ) : (
                                "Add to Pipeline"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
