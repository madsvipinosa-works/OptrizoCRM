"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Settings,
    Archive,
    AlertTriangle,
    Calendar,
    Users,
    ExternalLink,
    Briefcase,
    CheckCircle2,
    RotateCcw,
    Loader2,
    Sparkles,
    Clock,
    FileText,
    DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { updateProjectDetails, archiveProject, unarchiveProject, getClientUsers } from "@/features/pm/actions";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ProjectSettingsModalProps {
    project: {
        id: string;
        title: string;
        description?: string | null;
        status: "Kickoff" | "In Progress" | "In Review" | "Completed";
        startDate?: Date | string | null;
        targetDate?: Date | string | null;
        isArchived?: boolean;
        stakeholders?: Array<{
            user?: {
                id: string;
                name: string | null;
                email: string;
                role: string;
                image?: string | null;
            } | null;
        }>;
        lead?: {
            id: string;
            businessName?: string | null;
            contactName?: string | null;
            contactEmail?: string | null;
            contactPhone?: string | null;
            budget?: string | null;
            estimatedValue?: number | null;
            goals?: string | null;
        } | null;
    };
}

export function ProjectSettingsModal({ project }: ProjectSettingsModalProps) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"general" | "timeline" | "stakeholders" | "danger">("general");

    // Form fields
    const [title, setTitle] = useState(project.title || "");
    const [description, setDescription] = useState(project.description || "");
    const [status, setStatus] = useState<"Kickoff" | "In Progress" | "In Review" | "Completed">(
        project.status || "Kickoff"
    );

    const initialStartDate = project.startDate
        ? new Date(project.startDate).toISOString().split("T")[0]
        : "";
    const initialTargetDate = project.targetDate
        ? new Date(project.targetDate).toISOString().split("T")[0]
        : "";

    const [startDate, setStartDate] = useState(initialStartDate);
    const [targetDate, setTargetDate] = useState(initialTargetDate);

    // Initial client stakeholder
    const initialClient = project.stakeholders?.find(s => s.user?.role === "client")?.user;
    const [clientUserId, setClientUserId] = useState<string>(initialClient?.id || "unassigned");
    const [availableClients, setAvailableClients] = useState<Array<{ id: string; name: string | null; email: string }>>([]);

    const [isSaving, setIsSaving] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const router = useRouter();

    // Fetch registered clients when dialog opens
    useEffect(() => {
        if (open) {
            getClientUsers().then((clients) => {
                setAvailableClients(clients);
            });
            // Reset to current project props
            setTitle(project.title || "");
            setDescription(project.description || "");
            setStatus(project.status || "Kickoff");
            setStartDate(project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "");
            setTargetDate(project.targetDate ? new Date(project.targetDate).toISOString().split("T")[0] : "");
            const currentClient = project.stakeholders?.find(s => s.user?.role === "client")?.user;
            setClientUserId(currentClient?.id || "unassigned");
        }
    }, [open, project]);

    // Save project changes
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error("Project title cannot be empty");
            return;
        }

        setIsSaving(true);
        try {
            const res = await updateProjectDetails(project.id, {
                title: title.trim(),
                description: description.trim() || undefined,
                status,
                startDate: startDate || null,
                targetDate: targetDate || null,
                clientUserId: clientUserId === "unassigned" ? null : clientUserId,
            });

            if (res.success) {
                toast.success(res.message || "Project settings saved successfully.");
                setOpen(false);
                router.refresh();
            } else {
                toast.error(res.message || "Failed to update project settings.");
            }
        } catch (err) {
            console.error(err);
            toast.error("An unexpected error occurred while saving.");
        } finally {
            setIsSaving(false);
        }
    };

    // Handle Project Archive / Restore
    const handleArchiveToggle = async () => {
        const willArchive = !project.isArchived;
        const confirmMsg = willArchive
            ? "Are you sure you want to archive this project? It will be hidden from the active delivery board."
            : "Restore this project back to the active delivery board?";

        if (!confirm(confirmMsg)) return;

        setIsArchiving(true);
        try {
            const res = willArchive ? await archiveProject(project.id) : await unarchiveProject(project.id);
            if (res.success) {
                toast.success(res.message || (willArchive ? "Project archived." : "Project restored."));
                setOpen(false);
                if (willArchive) {
                    router.push("/dashboard/pm");
                } else {
                    router.refresh();
                }
            } else {
                toast.error(res.message || "Failed to update project archive status.");
            }
        } catch (err) {
            console.error(err);
            toast.error("An unexpected error occurred.");
        } finally {
            setIsArchiving(false);
        }
    };

    // Calculate delivery duration summary
    const calculateTimelineDuration = () => {
        if (!startDate && !targetDate) return null;
        if (startDate && targetDate) {
            const start = new Date(startDate).getTime();
            const target = new Date(targetDate).getTime();
            const diffDays = Math.round((target - start) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return { text: "Target date precedes start date", isWarning: true };
            const weeks = Math.round(diffDays / 7);
            return {
                text: `${diffDays} days (${weeks} week${weeks === 1 ? "" : "s"} scheduled delivery)`,
                isWarning: false,
            };
        }
        if (targetDate) {
            const target = new Date(targetDate).getTime();
            const now = Date.now();
            const remainingDays = Math.round((target - now) / (1000 * 60 * 60 * 24));
            if (remainingDays < 0) {
                return { text: `Target delivery date passed (${Math.abs(remainingDays)} days ago)`, isWarning: true };
            }
            return { text: `${remainingDays} days remaining until target delivery`, isWarning: false };
        }
        return null;
    };

    const timelineSummary = calculateTimelineDuration();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-border hover:bg-muted text-foreground shadow-xs gap-1.5">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    Settings
                </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] p-0 flex flex-col bg-card border-border text-foreground shadow-2xl rounded-2xl overflow-hidden focus:outline-none">
                {/* Modal Header */}
                <DialogHeader className="shrink-0 p-5 sm:p-6 pb-4 border-b border-border bg-card/95 backdrop-blur z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                            <Briefcase className="h-3.5 w-3.5" /> Project Lifecycle & Configuration
                        </div>
                        <Badge
                            variant="outline"
                            className={`text-[10px] font-mono font-semibold ${
                                status === "Completed"
                                    ? "bg-primary/10 text-primary border-primary/30"
                                    : status === "In Progress"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    : status === "In Review"
                                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                                    : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            }`}
                        >
                            {status}
                        </Badge>
                    </div>
                    <DialogTitle className="text-xl font-bold text-foreground tracking-tight">
                        Project Settings
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs mt-0.5">
                        Manage project scope, delivery timeline, client assignment, and lifecycle controls.
                    </DialogDescription>
                </DialogHeader>

                {/* Tabs Navigation */}
                <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="px-5 sm:px-6 pt-3 shrink-0">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                            <TabsList className="grid grid-cols-4 bg-muted/40 border border-border h-9">
                                <TabsTrigger value="general" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black font-medium">
                                    General
                                </TabsTrigger>
                                <TabsTrigger value="timeline" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black font-medium">
                                    Timeline
                                </TabsTrigger>
                                <TabsTrigger value="stakeholders" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black font-medium">
                                    Client & Deal
                                </TabsTrigger>
                                <TabsTrigger value="danger" className="text-xs data-[state=active]:bg-destructive data-[state=active]:text-white font-medium">
                                    Danger Zone
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Tab Contents */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                        {/* Tab 1: General & Status */}
                        {activeTab === "general" && (
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="proj-title" className="text-xs font-medium text-foreground">
                                        Project Title <span className="text-primary">*</span>
                                    </Label>
                                    <Input
                                        id="proj-title"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. Acme SaaS Platform MVP"
                                        required
                                        className="h-9 text-xs bg-muted/30 border-border text-foreground focus:border-primary"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="proj-status" className="text-xs font-medium text-foreground">
                                        Lifecycle Stage
                                    </Label>
                                    <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                                        <SelectTrigger id="proj-status" className="h-9 text-xs bg-muted/30 border-border text-foreground focus:border-primary">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card border-border text-foreground">
                                            <SelectItem value="Kickoff" className="text-xs">
                                                🔵 Kickoff (Onboarding & SOW Alignment)
                                            </SelectItem>
                                            <SelectItem value="In Progress" className="text-xs">
                                                🟢 In Progress (Active Sprints & Engineering)
                                            </SelectItem>
                                            <SelectItem value="In Review" className="text-xs">
                                                🟡 In Review (Client QA & Quality Gate Inspection)
                                            </SelectItem>
                                            <SelectItem value="Completed" className="text-xs">
                                                🏆 Completed (Final Sign-off & Production Delivery)
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-muted-foreground">
                                        Stage transitions govern milestone gating and client approval requirements.
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="proj-desc" className="text-xs font-medium text-foreground">
                                        Scope Description & Objectives
                                    </Label>
                                    <Textarea
                                        id="proj-desc"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Outline high-level deliverable goals, technical parameters, and business objectives..."
                                        rows={4}
                                        className="text-xs bg-muted/30 border-border text-foreground resize-none focus:border-primary"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Tab 2: Delivery Schedule */}
                        {activeTab === "timeline" && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="proj-start" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                            <Calendar className="h-3.5 w-3.5 text-primary" /> Start Date
                                        </Label>
                                        <Input
                                            id="proj-start"
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="h-9 text-xs bg-muted/30 border-border text-foreground focus:border-primary"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="proj-target" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5 text-amber-400" /> Target Delivery Date
                                        </Label>
                                        <Input
                                            id="proj-target"
                                            type="date"
                                            value={targetDate}
                                            onChange={(e) => setTargetDate(e.target.value)}
                                            className="h-9 text-xs bg-muted/30 border-border text-foreground focus:border-primary"
                                        />
                                    </div>
                                </div>

                                {timelineSummary && (
                                    <div
                                        className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                                            timelineSummary.isWarning
                                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                                : "bg-primary/10 border-primary/20 text-primary"
                                        }`}
                                    >
                                        <Sparkles className="h-4 w-4 shrink-0" />
                                        <span>{timelineSummary.text}</span>
                                    </div>
                                )}

                                <div className="p-3.5 rounded-lg bg-muted/20 border border-border text-xs space-y-2">
                                    <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> SLA Gating Rules
                                    </h4>
                                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                                        Milestones and individual task deadlines are bounded by the target delivery date. Active tasks with due dates past the target delivery will trigger warning banners on the PM engine dashboard.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Tab 3: Stakeholders & Originating Deal */}
                        {activeTab === "stakeholders" && (
                            <div className="space-y-4">
                                {/* Client Stakeholder Selection */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="proj-client" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5 text-primary" /> Primary Client Stakeholder
                                    </Label>
                                    <Select value={clientUserId} onValueChange={setClientUserId}>
                                        <SelectTrigger id="proj-client" className="h-9 text-xs bg-muted/30 border-border text-foreground focus:border-primary">
                                            <SelectValue placeholder="Select Client Stakeholder" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card border-border text-foreground">
                                            <SelectItem value="unassigned" className="text-xs text-muted-foreground">
                                                ⚪ Unassigned (No Client Portal Access)
                                            </SelectItem>
                                            {availableClients.map((client) => (
                                                <SelectItem key={client.id} value={client.id} className="text-xs">
                                                    👤 {client.name || "Client"} ({client.email})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-muted-foreground">
                                        The assigned client receives automated milestone sign-off requests and client portal visibility.
                                    </p>
                                </div>

                                {/* Originating Deal Card */}
                                {project.lead ? (
                                    <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                                <Briefcase className="h-3.5 w-3.5 text-primary" /> Originating Sales Deal
                                            </div>
                                            <Link
                                                href="/dashboard/leads"
                                                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                                            >
                                                <span>Open Pipeline</span>
                                                <ExternalLink className="h-3 w-3" />
                                            </Link>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Company / Lead</span>
                                                <span className="font-semibold text-foreground truncate block">
                                                    {project.lead.businessName || project.lead.contactName || "Direct Inquiry"}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Commercial Value</span>
                                                <span className="font-semibold font-mono text-emerald-400 block">
                                                    {project.lead.budget || (project.lead.estimatedValue ? `$${project.lead.estimatedValue.toLocaleString()}` : "N/A")}
                                                </span>
                                            </div>
                                            {project.lead.contactEmail && (
                                                <div className="col-span-2">
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Contact Coordinates</span>
                                                    <span className="text-muted-foreground text-[11px] truncate block">
                                                        {project.lead.contactEmail} {project.lead.contactPhone ? `• ${project.lead.contactPhone}` : ""}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                                        This project was initialized directly in the PM Engine without an originating sales lead.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab 4: Danger Zone */}
                        {activeTab === "danger" && (
                            <div className="space-y-4">
                                <div className="space-y-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
                                    <div className="flex items-center gap-2 text-destructive font-semibold">
                                        <AlertTriangle className="h-4 w-4 shrink-0" />
                                        <h4 className="text-sm">
                                            {project.isArchived ? "Restore Project" : "Archive Project"}
                                        </h4>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {project.isArchived
                                            ? "This project is currently archived. Restoring it will make it visible again on active delivery boards, client portals, and milestone analytics."
                                            : "Archiving this project will hide it from the active delivery board. Tasks and milestones remain safely preserved in historical records and can be restored at any time."}
                                    </p>
                                    <Button
                                        type="button"
                                        variant={project.isArchived ? "outline" : "destructive"}
                                        className="w-full text-xs font-semibold gap-1.5"
                                        onClick={handleArchiveToggle}
                                        disabled={isArchiving}
                                    >
                                        {project.isArchived ? (
                                            <>
                                                <RotateCcw className="h-3.5 w-3.5" />
                                                {isArchiving ? "Restoring..." : "Restore to Active Delivery"}
                                            </>
                                        ) : (
                                            <>
                                                <Archive className="h-3.5 w-3.5" />
                                                {isArchiving ? "Archiving..." : "Archive Project"}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <DialogFooter className="p-4 border-t border-border bg-card/95 backdrop-blur flex justify-end gap-2 shrink-0">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving}
                            className="bg-primary text-black hover:bg-primary/90 font-semibold text-xs gap-1.5"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving Changes...
                                </>
                            ) : (
                                "Save Settings"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
