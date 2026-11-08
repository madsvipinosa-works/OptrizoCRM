"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { todayYmd } from "@/lib/datetime";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateProjectDetails, archiveProject, unarchiveProject, getClientUsers } from "@/features/pm/actions";
import { useRouter } from "next/navigation";

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
                <Button variant="outline" size="icon" aria-label="Project settings" title="Project settings" className="size-9 shrink-0 bg-card text-muted-foreground hover:text-foreground active:scale-[0.97]">
                    <Settings className="size-4" aria-hidden="true" />
                </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-h-[90vh] gap-0 overflow-hidden rounded-xl p-0 sm:max-w-xl flex flex-col">
                <DialogHeader className="shrink-0 space-y-3 px-6 pt-6 pb-3 text-left">
                    <div>
                        <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">Project settings</DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-muted-foreground">
                            Name, dates, client account and archiving. The project&apos;s status changes on its own as milestones finish.
                        </DialogDescription>
                    </div>
                    <div role="group" aria-label="Settings sections" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/60">
                            <button
                                type="button"
                                onClick={() => setActiveTab("general")}
                                aria-pressed={activeTab === "general"}
                                className={`flex h-8 items-center justify-center rounded-md px-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring ${
                                    activeTab === "general" ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Details
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("timeline")}
                                aria-pressed={activeTab === "timeline"}
                                className={`flex h-8 items-center justify-center rounded-md px-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring ${
                                    activeTab === "timeline" ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Dates
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("stakeholders")}
                                aria-pressed={activeTab === "stakeholders"}
                                className={`flex h-8 items-center justify-center rounded-md px-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring ${
                                    activeTab === "stakeholders" ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Client
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("danger")}
                                aria-pressed={activeTab === "danger"}
                                className={`flex h-8 items-center justify-center rounded-md px-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring ${
                                    activeTab === "danger" ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Archive
                            </button>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-3">
                        {activeTab === "general" && (
                            <>
                                <div className="space-y-1.5">
                                    <Label htmlFor="proj-title" className="text-sm text-muted-foreground">Project name</Label>
                                    <Input id="proj-title" value={title} onChange={(e) => setTitle(e.target.value)} required className="h-10 bg-card text-sm" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="proj-desc" className="text-sm text-muted-foreground">Description</Label>
                                    <Textarea
                                        id="proj-desc"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="What the project delivers, in a few lines."
                                        rows={4}
                                        className="resize-none bg-card text-sm"
                                    />
                                </div>
                            </>
                        )}

                        {activeTab === "timeline" && (
                            <>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="proj-start" className="text-sm text-muted-foreground">Start date</Label>
                                        <DatePicker id="proj-start" value={startDate} onChange={setStartDate} className="bg-card text-sm" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="proj-target" className="text-sm text-muted-foreground">Target delivery date</Label>
                                        <DatePicker id="proj-target" value={targetDate} onChange={setTargetDate} min={startDate || todayYmd()} className="bg-card text-sm" />
                                    </div>
                                </div>
                                {timelineSummary && (
                                    <p
                                        className={`rounded-lg px-4 py-3 text-sm ${
                                            timelineSummary.isWarning ? "bg-stage-negotiation/10 text-stage-negotiation" : "bg-brand-soft text-brand-deep"
                                        }`}
                                    >
                                        {timelineSummary.text}
                                    </p>
                                )}
                                <p className="text-sm text-muted-foreground">Task due dates should fall on or before the target delivery date.</p>
                            </>
                        )}

                        {activeTab === "stakeholders" && (
                            <>
                                <div className="space-y-1.5">
                                    <Label htmlFor="proj-client" className="text-sm text-muted-foreground">Client account</Label>
                                    <Select value={clientUserId} onValueChange={setClientUserId}>
                                        <SelectTrigger id="proj-client" className="h-10 bg-card text-sm">
                                            <SelectValue placeholder="Pick the client account" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned" className="text-sm text-muted-foreground">No client account (no portal access)</SelectItem>
                                            {availableClients.map((client) => (
                                                <SelectItem key={client.id} value={client.id} className="text-sm">
                                                    {client.name || "Client"} ({client.email})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-sm text-muted-foreground">This person sees the project in the client portal and gets its updates.</p>
                                </div>

                                {project.lead ? (
                                    <section aria-labelledby="settings-lead" className="rounded-lg border border-border px-4 py-3">
                                        <h3 id="settings-lead" className="text-sm font-semibold text-foreground">From the sales lead</h3>
                                        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <dt className="text-muted-foreground">Business name</dt>
                                                <dd className="text-foreground">{project.lead.businessName || project.lead.contactName || "Not given"}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-muted-foreground">Estimated value</dt>
                                                <dd className="tabular-nums text-foreground">
                                                    {project.lead.budget || (project.lead.estimatedValue ? `₱${project.lead.estimatedValue.toLocaleString("en-PH")}` : "Not given")}
                                                </dd>
                                            </div>
                                            {project.lead.contactEmail && (
                                                <div className="col-span-2">
                                                    <dt className="text-muted-foreground">Contact</dt>
                                                    <dd className="truncate text-foreground">
                                                        {project.lead.contactEmail}{project.lead.contactPhone ? ` · ${project.lead.contactPhone}` : ""}
                                                    </dd>
                                                </div>
                                            )}
                                        </dl>
                                    </section>
                                ) : (
                                    <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">This project wasn&apos;t created from a sales lead.</p>
                                )}
                            </>
                        )}

                        {activeTab === "danger" && (
                            <section aria-labelledby="settings-archive" className="space-y-3 rounded-lg bg-destructive/5 px-4 py-4">
                                <h3 id="settings-archive" className="text-base font-semibold text-foreground">
                                    {project.isArchived ? "Restore this project" : "Archive this project"}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {project.isArchived
                                        ? "It comes back to the projects list and the client portal."
                                        : "It leaves the projects list. Tasks, files and history are kept, and you can restore it any time."}
                                </p>
                                <Button
                                    type="button"
                                    variant={project.isArchived ? "outline" : "destructive"}
                                    className="h-10 w-full font-semibold active:scale-[0.97]"
                                    onClick={handleArchiveToggle}
                                    disabled={isArchiving}
                                >
                                    {project.isArchived ? (isArchiving ? "Restoring..." : "Restore project") : isArchiving ? "Archiving..." : "Archive project"}
                                </Button>
                            </section>
                        )}
                    </div>

                    {activeTab !== "danger" && (
                        <div className="flex shrink-0 gap-3 px-6 pt-3 pb-6">
                            <Button type="submit" disabled={isSaving} className="h-10 flex-1 font-semibold active:scale-[0.97]">
                                {isSaving && <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />}
                                Save changes
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-10 bg-card px-5 active:scale-[0.97]">
                                Cancel
                            </Button>
                        </div>
                    )}
                </form>
            </DialogContent>
        </Dialog>
    );
}
