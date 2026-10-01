"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatus, updateMilestoneStatus, createTask, submitTaskProofAndMove, submitTaskBlockedReasonAndMove, deleteTask, updateTaskDetails } from "@/features/pm/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Users, AlertTriangle, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { MilestoneStatusDropdown } from "./MilestoneStatusDropdown";
import { AssigneeCombobox, TeamMemberItem } from "./AssigneeCombobox";
import { PmKanbanBoard, PmTask } from "./PmKanbanBoard";
import { TaskProofValidationModal } from "./TaskProofValidationModal";
import { TaskBlockedReasonModal } from "./TaskBlockedReasonModal";
import { TaskDeleteConfirmModal } from "./TaskDeleteConfirmModal";

interface KanbanMilestone {
    id: string;
    order: number;
    title: string;
    status: "Pending" | "In Progress" | "Client Approval" | "Completed";
    feedback?: { id: string; status: "APPROVED" | "REVISION_REQUESTED"; commentText: string | null; createdAt: Date }[];
}

interface KanbanProject {
    id: string;
    milestones: KanbanMilestone[];
    tasks: PmTask[];
}

export function KanbanBoard({
    project,
    teamMembers,
    currentUserId,
    currentUserRole,
}: {
    project: KanbanProject;
    teamMembers: TeamMemberItem[];
    currentUserId?: string;
    currentUserRole?: string;
}) {
    const router = useRouter();
    const [optimisticTasks, setOptimisticTasks] = useState<PmTask[]>(project.tasks || []);
    const [optimisticMilestones, setOptimisticMilestones] = useState<KanbanMilestone[]>(
        project.milestones?.sort((a, b) => a.order - b.order) || []
    );

    useEffect(() => {
        if (project.tasks) {
            setOptimisticTasks(project.tasks);
        }
    }, [project.tasks]);
    const [activeMilestoneId, setActiveMilestoneId] = useState<string>(project.milestones?.[0]?.id || "");
    const [isAddingTask, setIsAddingTask] = useState(false);

    // Filters
    const [filterAssignee, setFilterAssignee] = useState<string>("all");
    const [myTasksOnly, setMyTasksOnly] = useState<boolean>(!["superadmin", "manager"].includes(currentUserRole || ""));

    // Edit Task State
    const [editingTask, setEditingTask] = useState<PmTask | null>(null);
    const [editTaskTitle, setEditTaskTitle] = useState("");
    const [editTaskDesc, setEditTaskDesc] = useState("");
    const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
    const [editDueDate, setEditDueDate] = useState("");
    const [editTaskWeight, setEditTaskWeight] = useState<number>(1);
    const [editTaskHours, setEditTaskHours] = useState<string>("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Delete Task State
    const [deletingTask, setDeletingTask] = useState<PmTask | null>(null);

    // Task Form state
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);
    const [newTaskWeight, setNewTaskWeight] = useState<number>(1);
    const [newTaskHours, setNewTaskHours] = useState<string>("");

    // Workload & Capacity Guardrail constants and calculations
    const STANDARD_WEEKLY_CAPACITY = 40;

    const memberWorkloadMap = useMemo(() => {
        const map = new Map<string, { totalHours: number; taskCount: number }>();
        teamMembers.forEach((m) => map.set(m.id, { totalHours: 0, taskCount: 0 }));

        optimisticTasks.forEach((t) => {
            if (t.status !== "Done" && t.assignees) {
                const hours = t.estimatedHours || 0;
                t.assignees.forEach((a) => {
                    const current = map.get(a.user.id) || { totalHours: 0, taskCount: 0 };
                    map.set(a.user.id, {
                        totalHours: current.totalHours + hours,
                        taskCount: current.taskCount + 1,
                    });
                });
            }
        });
        return map;
    }, [optimisticTasks, teamMembers]);

    const overloadedMembers = useMemo(() => {
        const overloaded: { member: TeamMemberItem; hours: number; percentage: number; overHours: number }[] = [];
        teamMembers.forEach((m) => {
            const stats = memberWorkloadMap.get(m.id);
            const hours = stats?.totalHours || 0;
            if (hours > STANDARD_WEEKLY_CAPACITY) {
                overloaded.push({
                    member: m,
                    hours,
                    percentage: Math.round((hours / STANDARD_WEEKLY_CAPACITY) * 100),
                    overHours: hours - STANDARD_WEEKLY_CAPACITY,
                });
            }
        });
        return overloaded;
    }, [memberWorkloadMap, teamMembers]);

    // Task Proof Intercept state
    const [proofingTask, setProofingTask] = useState<{
        task: PmTask;
        targetStatus: "In Review" | "Done";
    } | null>(null);

    // Task Proof Viewing state
    const [viewingProofsTask, setViewingProofsTask] = useState<{ task: PmTask; initialTab?: "proofs" | "audit" } | null>(null);

    // Task Blocked Intercept state
    const [blockingTask, setBlockingTask] = useState<{
        task: PmTask;
    } | null>(null);

    // Task Details Viewing state
    const [viewingTaskDetails, setViewingTaskDetails] = useState<PmTask | null>(null);

    // Milestone State
    const [isAddingMilestone, setIsAddingMilestone] = useState(false);
    const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
    const [isSavingMilestone, setIsSavingMilestone] = useState(false);
    const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
    const [editMilestoneTitle, setEditMilestoneTitle] = useState("");
    const [editMilestoneOrder, setEditMilestoneOrder] = useState<number>(1);
    const [isSavingMilestoneEdit, setIsSavingMilestoneEdit] = useState(false);

    const activeMilestone = optimisticMilestones?.find((m) => m.id === activeMilestoneId);
    if (!activeMilestone && optimisticMilestones.length > 0) {
        setActiveMilestoneId(optimisticMilestones[0].id);
    }

    let tasksForMilestone = optimisticTasks.filter((t) => t.milestoneId === activeMilestoneId);

    // Apply Filters
    if (myTasksOnly && currentUserId) {
        tasksForMilestone = tasksForMilestone.filter((t) =>
            t.assignees?.some((a) => a.user.id === currentUserId)
        );
    } else if (filterAssignee !== "all") {
        if (filterAssignee === "unassigned") {
            tasksForMilestone = tasksForMilestone.filter(
                (t) => !t.assignees || t.assignees.length === 0
            );
        } else {
            tasksForMilestone = tasksForMilestone.filter((t) =>
                t.assignees?.some((a) => a.user.id === filterAssignee)
            );
        }
    }

    const handleStatusChangeRequest = (
        taskId: string,
        targetStatus: PmTask["status"]
    ) => {
        const task = optimisticTasks.find((t) => t.id === taskId);
        if (!task) return;

        if (activeMilestone?.status === "Client Approval" && targetStatus !== "Blocked") {
            toast.error("Cannot unblock task while Milestone is awaiting Client Approval.");
            return;
        }

        if (targetStatus === "Done" && !["superadmin", "manager"].includes(currentUserRole || "")) {
            toast.error("Only Managers and Super-Admins can approve tasks to Done.");
            return;
        }

        // Always intercept if moving to "In Review" or "Done"
        if (targetStatus === "In Review" || targetStatus === "Done") {
            setProofingTask({
                task,
                targetStatus: targetStatus as "In Review" | "Done",
            });
            return;
        }

        // Intercept if moving to "Blocked"
        if (targetStatus === "Blocked") {
            setBlockingTask({ task });
            return;
        }

        // Direct optimistic update for non-intercepted moves
        const updated = optimisticTasks.map((t) =>
            t.id === taskId ? { ...t, status: targetStatus } : t
        );
        setOptimisticTasks(updated);

        updateTaskStatus(taskId, targetStatus).then((res) => {
            if (!res.success) {
                toast.error(res.message || "Failed to update task status");
                setOptimisticTasks(optimisticTasks); // Revert
            } else {
                router.refresh();
            }
        });
    };

    const handleConfirmTaskProof = async (proofLinks: { label: string; url: string }[], proofNotes: string) => {
        if (!proofingTask) return;

        const { task, targetStatus } = proofingTask;

        // Optimistic UI Update
        const updated = optimisticTasks.map((t) =>
            t.id === task.id
                ? {
                    ...t,
                    status: targetStatus,
                    proofLinks: proofLinks.length > 0 ? proofLinks : t.proofLinks,
                    proofNotes: proofNotes || t.proofNotes,
                }
                : t
        );
        setOptimisticTasks(updated);

        const res = await submitTaskProofAndMove(task.id, targetStatus, proofLinks, proofNotes);
        if (!res.success) {
            toast.error(res.message || "Failed to submit task proof");
            setOptimisticTasks(optimisticTasks); // Revert
        } else {
            const msg = res.message || "Task proof submitted & status updated!";
            if (msg.includes("Changes requested") || msg.includes("Changes Requested") || msg.includes("unverified")) {
                toast.warning(msg);
                setOptimisticTasks((prev) =>
                    prev.map((t) =>
                        t.id === task.id ? { ...t, status: "Changes Requested" as const } : t
                    )
                );
            } else {
                toast.success(msg);
            }
            router.refresh();
        }

        setProofingTask(null);
    };

    const handleConfirmTaskBlocked = async (blockedReason: string) => {
        if (!blockingTask) return;

        const { task } = blockingTask;

        // Optimistic UI Update
        const updated = optimisticTasks.map((t) =>
            t.id === task.id
                ? {
                    ...t,
                    status: "Blocked" as const,
                    blockedReason: blockedReason,
                }
                : t
        );
        setOptimisticTasks(updated);

        const res = await submitTaskBlockedReasonAndMove(task.id, blockedReason);
        if (!res.success) {
            toast.error(res.message || "Failed to block task");
            setOptimisticTasks(optimisticTasks); // Revert
        } else {
            toast.success("Task flagged as Blocked with reason!");
        }

        setBlockingTask(null);
    };

    const handleConfirmDeleteTask = async () => {
        if (!deletingTask) return;

        const taskId = deletingTask.id;
        const updated = optimisticTasks.filter((t) => t.id !== taskId);
        setOptimisticTasks(updated);

        const res = await deleteTask(taskId);
        if (!res.success) {
            toast.error(res.message || "Failed to delete task");
            setOptimisticTasks(optimisticTasks); // Revert
        } else {
            toast.success("Task soft-deleted");
        }

        setDeletingTask(null);
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeMilestone) return;
        setIsAddingTask(true);
        const res = await createTask(
            project.id,
            activeMilestoneId,
            newTaskTitle,
            newTaskDesc,
            newAssigneeIds,
            newTaskWeight,
            newTaskHours ? parseInt(newTaskHours) : undefined
        );
        if (res.success && res.task) {
            toast.success("Task added");
            const optimisticNewTask: PmTask = {
                ...(res.task as unknown as PmTask),
                assignees: teamMembers
                    .filter((m) => newAssigneeIds.includes(m.id))
                    .map((m) => ({ user: m })),
            };
            setOptimisticTasks([...optimisticTasks, optimisticNewTask]);
            setNewTaskTitle("");
            setNewTaskDesc("");
            setNewAssigneeIds([]);
            setNewTaskWeight(1);
            setNewTaskHours("");
            router.refresh();
        } else {
            toast.error(res.message || "Failed to create task");
        }
        setIsAddingTask(false);
    };

    const openEditModal = (task: PmTask) => {
        setEditingTask(task);
        setEditTaskTitle(task.title);
        setEditTaskDesc(task.description || "");
        setEditAssigneeIds(task.assignees?.map((a) => a.user.id) || []);
        setEditDueDate(
            task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""
        );
        setEditTaskWeight(task.weight ?? 1);
        setEditTaskHours(task.estimatedHours != null ? String(task.estimatedHours) : "");
    };

    const handleEditTaskSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTask) return;
        setIsSavingEdit(true);

        const dueToSubmit = editDueDate ? new Date(editDueDate) : null;
        const hoursToSubmit = editTaskHours ? parseInt(editTaskHours) : null;

        const updatedTasks = optimisticTasks.map((t) =>
            t.id === editingTask.id
                ? {
                    ...t,
                    title: editTaskTitle,
                    description: editTaskDesc,
                    assignees: teamMembers
                        .filter((m) => editAssigneeIds.includes(m.id))
                        .map((m) => ({ user: m })),
                    dueDate: dueToSubmit,
                    weight: editTaskWeight,
                    estimatedHours: hoursToSubmit,
                }
                : t
        );
        setOptimisticTasks(updatedTasks);
        setEditingTask(null);

        const res = await updateTaskDetails(editingTask.id, {
            title: editTaskTitle,
            description: editTaskDesc,
            assigneeIds: editAssigneeIds,
            dueDate: dueToSubmit,
            weight: editTaskWeight,
            estimatedHours: hoursToSubmit,
        });

        if (!res.success) {
            toast.error(res.message || "Failed to update task");
            setOptimisticTasks(optimisticTasks);
        } else {
            toast.success("Task details updated");
            router.refresh();
        }
        setIsSavingEdit(false);
    };

    const handleCreateMilestone = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingMilestone(true);
        const { createMilestone } = await import("@/features/pm/actions");
        const res = await createMilestone(project.id, newMilestoneTitle);
        if (res.success && res.milestone) {
            toast.success("Milestone created.");
            const newM = res.milestone as unknown as KanbanMilestone;
            setOptimisticMilestones((prev) => [...prev, newM]);
            setActiveMilestoneId(newM.id);
            setNewMilestoneTitle("");
            setIsAddingMilestone(false);
        } else {
            toast.error(res.message);
        }
        setIsSavingMilestone(false);
    };

    const handleDeleteMilestone = async (id: string) => {
        if (!confirm("Are you sure you want to delete this Milestone? All tasks within will be deleted."))
            return;

        setOptimisticMilestones(optimisticMilestones.filter((m) => m.id !== id));
        if (activeMilestoneId === id) {
            setActiveMilestoneId(optimisticMilestones.find((m) => m.id !== id)?.id || "");
        }

        const { deleteMilestone } = await import("@/features/pm/actions");
        const res = await deleteMilestone(id);
        if (!res.success) {
            toast.error(res.message);
            setOptimisticMilestones(optimisticMilestones);
        } else {
            toast.success("Milestone deleted.");
        }
    };

    const handleUpdateMilestone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMilestoneId || !editMilestoneTitle.trim()) return;

        const currentMilestone = optimisticMilestones.find((m) => m.id === editingMilestoneId);
        if (!currentMilestone) return;

        const trimmedTitle = editMilestoneTitle.trim();
        const parsedOrder = Number(editMilestoneOrder) || currentMilestone.order;

        if (trimmedTitle === currentMilestone.title && parsedOrder === currentMilestone.order) {
            setEditingMilestoneId(null);
            return;
        }

        setIsSavingMilestoneEdit(true);
        const previousMilestones = [...optimisticMilestones];

        // Optimistically re-sequence milestones to prevent duplicate sequence numbers
        const remaining = optimisticMilestones.filter((m) => m.id !== editingMilestoneId);
        const targetIndex = Math.max(0, Math.min(parsedOrder - 1, remaining.length));
        remaining.splice(targetIndex, 0, {
            ...currentMilestone,
            title: trimmedTitle,
        });

        const updatedMilestones = remaining.map((m, idx) => ({
            ...m,
            order: idx + 1,
        }));

        setOptimisticMilestones(updatedMilestones);

        const { editMilestone } = await import("@/features/pm/actions");
        const res = await editMilestone(editingMilestoneId, trimmedTitle, parsedOrder);

        if (!res.success) {
            toast.error(res.message || "Failed to update milestone");
            setOptimisticMilestones(previousMilestones);
        } else {
            toast.success("Milestone updated.");
            setEditingMilestoneId(null);
            setEditMilestoneTitle("");
            router.refresh();
        }
        setIsSavingMilestoneEdit(false);
    };

    const handleMilestoneStatusChange = async (newStatus: string) => {
        if (!activeMilestone) return;
        const res = await updateMilestoneStatus(
            activeMilestoneId,
            newStatus as KanbanMilestone["status"]
        );
        if (res.success) {
            const updated = optimisticMilestones.map((m) =>
                m.id === activeMilestoneId
                    ? { ...m, status: newStatus as KanbanMilestone["status"] }
                    : m
            );
            setOptimisticMilestones(updated);

            if (newStatus === "Client Approval") {
                toast.warning("Milestone requires Client Approval. All active tasks inside are now Blocked.", {
                    duration: 5000,
                });
                setOptimisticTasks(
                    optimisticTasks.map((t) =>
                        t.milestoneId === activeMilestoneId && t.status === "In Progress"
                            ? { ...t, status: "Blocked" }
                            : t
                    )
                );
            } else if (activeMilestone.status === "Client Approval") {
                toast.success("Client Approved. Tasks unblocked.");
                setOptimisticTasks(
                    optimisticTasks.map((t) =>
                        t.milestoneId === activeMilestoneId && t.status === "Blocked"
                            ? { ...t, status: "Todo" }
                            : t
                    )
                );
            } else {
                toast.success(`Milestone status updated to ${newStatus}`);
            }
        }
    };

    if (!activeMilestone) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-card border border-border rounded-xl mt-4 text-center">
                <h3 className="text-xl font-bold mb-2 text-foreground">No Milestones</h3>
                <p className="text-muted-foreground mb-4">Create a milestone to start organizing your project tasks.</p>
                {["superadmin", "manager"].includes(currentUserRole || "") && (
                    <Dialog open={isAddingMilestone} onOpenChange={setIsAddingMilestone}>
                        <DialogTrigger asChild>
                            <Button className="bg-primary hover:bg-primary/90 text-black font-semibold shadow-xs">
                                <Plus className="h-4 w-4 mr-2" /> Add Milestone
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-card border-border text-foreground shadow-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-foreground">Add New Milestone</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateMilestone} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label className="text-foreground">Milestone Title</Label>
                                    <Input
                                        required
                                        value={newMilestoneTitle}
                                        onChange={(e) => setNewMilestoneTitle(e.target.value)}
                                        className="bg-background border-border text-foreground"
                                        placeholder="e.g. Design Phase"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isSavingMilestone}
                                    className="w-full bg-primary hover:bg-primary/90 text-black font-semibold shadow-xs"
                                >
                                    Create Milestone
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col pt-2">
            {/* Milestone Tabs */}
            <div className="flex gap-2 mb-2.5 overflow-x-auto pb-1 shrink-0 items-center scrollbar-none">
                {optimisticMilestones.map((m) => (
                    <button
                        key={m.id}
                        onClick={() => setActiveMilestoneId(m.id)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${activeMilestoneId === m.id
                                ? "bg-primary text-black font-bold border-primary shadow-xs"
                                : "bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {m.order}. {m.title}
                    </button>
                ))}

                {["superadmin", "manager"].includes(currentUserRole || "") && (
                    <Dialog open={isAddingMilestone} onOpenChange={setIsAddingMilestone}>
                        <DialogTrigger asChild>
                            <button className="px-3 py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted text-muted-foreground hover:text-foreground whitespace-nowrap flex items-center gap-1 transition-all shrink-0">
                                <Plus className="h-3.5 w-3.5" /> Add
                            </button>
                        </DialogTrigger>
                        <DialogContent className="bg-card border-border text-foreground shadow-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-foreground">Add New Milestone</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateMilestone} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label className="text-foreground">Milestone Title</Label>
                                    <Input
                                        required
                                        value={newMilestoneTitle}
                                        onChange={(e) => setNewMilestoneTitle(e.target.value)}
                                        className="bg-background border-border text-foreground"
                                        placeholder="e.g. Design Phase"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isSavingMilestone}
                                    className="w-full bg-primary hover:bg-primary/90 text-black font-semibold shadow-xs"
                                >
                                    Create Milestone
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Active Milestone Context Bar & Toolbar */}
            <div className="flex items-center justify-between bg-card/70 px-3.5 py-2 rounded-xl border border-border mb-3 shrink-0 flex-wrap gap-2.5">
                <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                        {activeMilestone.title}
                        {["superadmin", "manager"].includes(currentUserRole || "") && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-50 hover:opacity-100 text-muted-foreground hover:text-foreground"
                                    >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <circle cx="12" cy="12" r="1" />
                                                <circle cx="12" cy="5" r="1" />
                                                <circle cx="12" cy="19" r="1" />
                                            </svg>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-40 bg-card border-border text-foreground shadow-xl">
                                        <DropdownMenuItem
                                            onClick={() => {
                                                setEditingMilestoneId(activeMilestone.id);
                                                setEditMilestoneTitle(activeMilestone.title);
                                                setEditMilestoneOrder(activeMilestone.order);
                                            }}
                                            className="gap-2 cursor-pointer"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                            Edit Milestone
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-rose-500 focus:text-rose-500 focus:bg-rose-500/10 cursor-pointer"
                                            onClick={() => handleDeleteMilestone(activeMilestone.id)}
                                        >
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                        )}
                    </h3>
                    {["superadmin", "manager"].includes(currentUserRole || "") ? (
                        <MilestoneStatusDropdown
                            status={activeMilestone.status}
                            onStatusChange={handleMilestoneStatusChange}
                        />
                    ) : (
                        <Badge variant="outline" className="border-border text-muted-foreground font-mono text-[10px]">
                            {activeMilestone.status}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {/* Team Capacity Tracker Popover */}
                    {["superadmin", "manager"].includes(currentUserRole || "") && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "h-8 text-xs border-border bg-card/80 gap-1.5",
                                        overloadedMembers.length > 0
                                            ? "text-rose-500 hover:text-rose-600 border-rose-500/30 hover:bg-rose-500/10"
                                            : "text-foreground hover:bg-muted"
                                    )}
                                    title="View team workload & capacity allocation"
                                >
                                    <Users className="w-3.5 h-3.5 text-primary" />
                                    <span className="hidden sm:inline">Capacity</span>
                                    {overloadedMembers.length > 0 ? (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-500 border border-rose-500/40">
                                             {overloadedMembers.length} Over
                                        </span>
                                    ) : (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                            Balanced
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 bg-card border-border text-foreground p-4 shadow-2xl space-y-3 z-50">
                                <div className="border-b border-border pb-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5 text-primary" />
                                            Weekly Capacity Guardrail
                                        </h4>
                                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                            40h / week
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        Active workload across all ongoing tasks
                                    </p>
                                </div>
                                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                                    {teamMembers.map((member) => {
                                        const stats = memberWorkloadMap.get(member.id);
                                        const hours = stats?.totalHours || 0;
                                        const pct = Math.round((hours / STANDARD_WEEKLY_CAPACITY) * 100);
                                        const isOver = hours > STANDARD_WEEKLY_CAPACITY;
                                        return (
                                            <div
                                                key={member.id}
                                                className={cn(
                                                    "space-y-1.5 p-2.5 rounded-lg border transition-colors cursor-pointer",
                                                    filterAssignee === member.id
                                                        ? "bg-primary/10 border-primary/40"
                                                        : "bg-background border-border hover:bg-muted/50"
                                                )}
                                                onClick={() => {
                                                    setFilterAssignee(member.id);
                                                    setMyTasksOnly(false);
                                                }}
                                                title="Click to filter board by this developer"
                                            >
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-medium text-foreground truncate max-w-[140px]">
                                                        {member.name || member.id}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            "font-mono text-[11px] font-bold",
                                                            isOver
                                                                ? "text-rose-500"
                                                                : hours >= 32
                                                                ? "text-amber-500"
                                                                : "text-emerald-600 dark:text-emerald-400"
                                                        )}
                                                    >
                                                        {hours}h / 40h ({pct}%)
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full transition-all",
                                                            isOver ? "bg-rose-500" : hours >= 32 ? "bg-amber-500" : "bg-primary"
                                                        )}
                                                        style={{ width: `${Math.min(100, pct)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}

                    {/* Filter Assignee */}
                    {["superadmin", "manager"].includes(currentUserRole || "") && (
                        <div className="flex items-center gap-1.5">
                            <Select
                                value={filterAssignee}
                                onValueChange={(val) => {
                                    setFilterAssignee(val);
                                    if (val !== "all") setMyTasksOnly(false);
                                }}
                            >
                                <SelectTrigger className="w-[155px] h-8 bg-card border-border text-xs text-foreground">
                                    <SelectValue placeholder="All Tasks" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground">
                                    <SelectItem value="all">All Assignees</SelectItem>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {teamMembers.map((member) => {
                                        const stats = memberWorkloadMap.get(member.id);
                                        const hours = stats?.totalHours || 0;
                                        const isOver = hours > STANDARD_WEEKLY_CAPACITY;
                                        return (
                                            <SelectItem key={member.id} value={member.id}>
                                                <div className="flex items-center justify-between gap-2 w-full">
                                                    <span className="truncate max-w-[90px]">{member.name || member.id}</span>
                                                    <span
                                                        className={cn(
                                                            "text-[10px] font-mono px-1 rounded shrink-0",
                                                            isOver
                                                                ? "text-rose-500 font-bold bg-rose-500/10 border border-rose-500/30"
                                                                : hours >= 32
                                                                ? "text-amber-500 font-medium bg-amber-500/10"
                                                                : "text-muted-foreground"
                                                        )}
                                                    >
                                                        {hours}h{isOver ? " ⚠️" : ""}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {currentUserId && (
                        <Button
                            variant={myTasksOnly ? "default" : "outline"}
                            size="sm"
                            className={`h-8 text-xs ${myTasksOnly
                                    ? "bg-primary text-black font-semibold border-primary shadow-xs"
                                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                            onClick={() => {
                                setMyTasksOnly(!myTasksOnly);
                                if (!myTasksOnly) setFilterAssignee("all");
                            }}
                        >
                            My Tasks
                        </Button>
                    )}

                    {["superadmin", "manager"].includes(currentUserRole || "") && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button size="sm" className="h-8 bg-primary hover:bg-primary/90 text-black font-semibold shadow-xs text-xs">
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Task
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] sm:max-h-[85vh] p-0 flex flex-col bg-card border-border text-foreground shadow-2xl rounded-2xl overflow-hidden focus:outline-none">
                                <DialogHeader className="shrink-0 p-5 sm:p-6 pb-3 border-b border-border bg-card/95 backdrop-blur z-10">
                                    <DialogTitle className="text-lg font-bold text-foreground tracking-tight">Add Task to {activeMilestone.title}</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleCreateTask} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                    <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Task Title</Label>
                                            <Input
                                                className="bg-background border-border focus:border-primary text-foreground placeholder:text-muted-foreground text-xs sm:text-sm"
                                                value={newTaskTitle}
                                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                                placeholder="e.g. Implement OAuth Flow"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Description (Optional)</Label>
                                            <Textarea
                                                className="bg-background border-border focus:border-primary resize-none text-foreground placeholder:text-muted-foreground text-xs sm:text-sm"
                                                rows={3}
                                                value={newTaskDesc}
                                                onChange={(e) => setNewTaskDesc(e.target.value)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Effort Weight</Label>
                                                <div className="flex gap-1.5">
                                                    {[1, 2, 3, 5, 8].map((pts) => (
                                                        <button
                                                            key={pts}
                                                            type="button"
                                                            onClick={() => setNewTaskWeight(pts)}
                                                            className={`flex-1 py-1.5 rounded-md text-xs font-mono font-bold border transition-all ${
                                                                newTaskWeight === pts
                                                                    ? "bg-primary text-black border-primary shadow-xs"
                                                                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                                                            }`}
                                                        >
                                                            {pts}p
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Est. Hours</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="500"
                                                    placeholder="e.g. 8"
                                                    value={newTaskHours}
                                                    onChange={(e) => setNewTaskHours(e.target.value)}
                                                    className="bg-background border-border focus:border-primary text-foreground placeholder:text-muted-foreground text-xs"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Assign Staff</Label>
                                            <AssigneeCombobox
                                                teamMembers={teamMembers}
                                                selectedIds={newAssigneeIds}
                                                onSelectionChange={setNewAssigneeIds}
                                                placeholder="Select assigned staff..."
                                            />
                                        </div>

                                        {/* Workload & Capacity Guardrail Alert */}
                                        {(() => {
                                            const hours = parseInt(newTaskHours) || 0;
                                            if (newAssigneeIds.length === 0 || hours <= 0) return null;

                                            const warnings = newAssigneeIds
                                                .map((id) => {
                                                    const member = teamMembers.find((m) => m.id === id);
                                                    const currentHours = memberWorkloadMap.get(id)?.totalHours || 0;
                                                    const projectedHours = currentHours + hours;
                                                    if (projectedHours > STANDARD_WEEKLY_CAPACITY || hours > STANDARD_WEEKLY_CAPACITY) {
                                                        return {
                                                            name: member?.name || "Developer",
                                                            currentHours,
                                                            projectedHours,
                                                            overHours: projectedHours - STANDARD_WEEKLY_CAPACITY,
                                                            percentage: Math.round((projectedHours / STANDARD_WEEKLY_CAPACITY) * 100),
                                                        };
                                                    }
                                                    return null;
                                                })
                                                .filter(Boolean);

                                            if (warnings.length === 0) return null;

                                            return (
                                                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 space-y-1.5 animate-in fade-in duration-200">
                                                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-rose-500">
                                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                                                        <span>Workload & Capacity Guardrail Alert</span>
                                                    </div>
                                                    {warnings.map((w, i) => (
                                                        <p key={i} className="text-[11px] text-muted-foreground leading-relaxed pl-5">
                                                            Assigning <strong className="text-foreground">{hours}h</strong> puts <strong className="text-foreground">{w?.name}</strong> at{" "}
                                                            <strong className="text-rose-500">{w?.projectedHours}h / {STANDARD_WEEKLY_CAPACITY}h</strong> capacity (
                                                            <span className="text-rose-500 font-bold">{w?.percentage}% allocation</span>, +{w?.overHours}h over 40h standard week).
                                                        </p>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="shrink-0 p-4 sm:p-5 border-t border-border bg-card/95 backdrop-blur">
                                        <Button
                                            type="submit"
                                            disabled={isAddingTask}
                                            className="w-full bg-primary hover:bg-primary/90 text-black font-semibold text-xs sm:text-sm"
                                        >
                                            Create Task
                                        </Button>
                                    </div>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {/* dnd-kit PmKanbanBoard */}
            <div className="flex-1 min-h-0 flex flex-col">
                <PmKanbanBoard
                    tasks={tasksForMilestone}
                    teamMembers={teamMembers}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                    onStatusChangeRequest={handleStatusChangeRequest}
                    onEditTask={openEditModal}
                    onDeleteTask={(task) => setDeletingTask(task)}
                    onViewProofs={(task, initialTab) => setViewingProofsTask({ task, initialTab })}
                    onClickTask={(task) => setViewingTaskDetails(task)}
                />
            </div>

            {/* Task Proof Intercept Modal */}
            <TaskProofValidationModal
                open={!!proofingTask}
                onOpenChange={(open) => {
                    if (!open) setProofingTask(null);
                }}
                task={proofingTask?.task || null}
                targetStatus={proofingTask?.targetStatus || "In Review"}
                onConfirm={handleConfirmTaskProof}
            />

            {/* Task Proof Viewing/Editing Modal */}
            <TaskProofValidationModal
                open={!!viewingProofsTask}
                onOpenChange={(open) => {
                    if (!open) setViewingProofsTask(null);
                }}
                task={viewingProofsTask?.task || null}
                targetStatus={(viewingProofsTask?.task?.status as "In Review" | "Done") || "In Review"}
                mode="edit"
                initialTab={viewingProofsTask?.initialTab || "proofs"}
                isViewOnly={
                    !(
                        ["superadmin", "manager"].includes(currentUserRole || "") ||
                        viewingProofsTask?.task?.assignees?.some((a) => a.user.id === currentUserId)
                    )
                }
                onConfirm={async (proofLinks, proofNotes) => {
                    if (!viewingProofsTask?.task) return;
                    const taskId = viewingProofsTask.task.id;
                    const res = await submitTaskProofAndMove(
                        taskId,
                        viewingProofsTask.task.status as "In Review" | "Done",
                        proofLinks,
                        proofNotes
                    );
                    if (!res.success) {
                        toast.error(res.message || "Failed to update task proofs");
                        throw new Error(res.message || "Failed to update task proofs");
                    } else {
                        toast.success("Task proofs updated!");
                        const updated = optimisticTasks.map((t) =>
                            t.id === taskId
                                ? {
                                      ...t,
                                      proofLinks,
                                      proofNotes,
                                  }
                                : t
                        );
                        setOptimisticTasks(updated);
                        router.refresh();
                    }
                }}
                onRequestChanges={
                    ["superadmin", "manager"].includes(currentUserRole || "") &&
                    viewingProofsTask?.task?.status === "In Review"
                        ? async () => {
                              const taskId = viewingProofsTask!.task.id;
                              const res = await updateTaskStatus(taskId, "Changes Requested");
                              if (!res.success) {
                                  throw new Error(res.message || "Failed to request changes");
                              }
                              toast.warning(`"${viewingProofsTask!.task.title}" sent back — Changes Requested.`);
                              setOptimisticTasks((prev) =>
                                  prev.map((t) =>
                                      t.id === taskId ? { ...t, status: "Changes Requested" } : t
                                  )
                              );
                              setViewingProofsTask(null);
                              router.refresh();
                          }
                        : undefined
                }
            />

            {/* Task Blocked Reason Intercept Modal */}
            <TaskBlockedReasonModal
                open={!!blockingTask}
                onOpenChange={(open) => {
                    if (!open) setBlockingTask(null);
                }}
                task={blockingTask?.task || null}
                onConfirm={handleConfirmTaskBlocked}
            />

            {/* Task Soft-Delete Confirmation Modal */}
            <TaskDeleteConfirmModal
                open={!!deletingTask}
                onOpenChange={(open) => {
                    if (!open) setDeletingTask(null);
                }}
                taskTitle={deletingTask?.title}
                onConfirm={handleConfirmDeleteTask}
            />

            {/* Task Details Modal */}
            <Dialog open={!!viewingTaskDetails} onOpenChange={(open) => !open && setViewingTaskDetails(null)}>
                <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-card border-border text-foreground shadow-2xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold break-words pr-4 leading-tight">{viewingTaskDetails?.title}</DialogTitle>
                    </DialogHeader>
                    {viewingTaskDetails && (
                        <div className="space-y-6 pt-2">
                            {/* Status & Effort */}
                            <div className="flex flex-wrap gap-2 items-center bg-muted/20 p-3 rounded-lg border border-border">
                                <Badge variant="outline" className="bg-background text-foreground border-border">{viewingTaskDetails.status}</Badge>
                                {viewingTaskDetails.weight && (
                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                        {viewingTaskDetails.weight} pts
                                    </Badge>
                                )}
                                {viewingTaskDetails.estimatedHours && (
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                        {viewingTaskDetails.estimatedHours}h
                                    </Badge>
                                )}
                            </div>

                            {/* Description */}
                            <div>
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Description</h4>
                                <div className="text-sm bg-muted/30 p-4 rounded-xl min-h-[60px] whitespace-pre-wrap border border-border">
                                    {viewingTaskDetails.description || <span className="text-muted-foreground italic">No description provided.</span>}
                                </div>
                            </div>

                            {/* Assignees */}
                            {viewingTaskDetails.assignees && viewingTaskDetails.assignees.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Assignees</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {viewingTaskDetails.assignees.map(a => (
                                            <div key={a.user.id} className="flex items-center gap-2 bg-muted/30 border border-border px-3 py-1.5 rounded-full shadow-sm">
                                                <Avatar className="w-6 h-6 border border-border">
                                                    {a.user.image && <AvatarImage src={a.user.image} />}
                                                    <AvatarFallback className="text-[10px] bg-primary text-black font-bold">
                                                        {a.user.name?.substring(0, 2).toUpperCase() || "U"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm font-medium">{a.user.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Proof Links & Notes */}
                            {(viewingTaskDetails.proofLinks?.length || viewingTaskDetails.proofNotes) ? (
                                <div className="space-y-4 pt-4 border-t border-border">
                                    {viewingTaskDetails.proofLinks && viewingTaskDetails.proofLinks.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Proof Links</h4>
                                            <div className="flex flex-col gap-2">
                                                {viewingTaskDetails.proofLinks.map((link, idx) => (
                                                    <a key={idx} href={link.url} target="_blank" rel="noreferrer" className="text-sm text-blue-500 hover:text-blue-600 hover:underline flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                                        </div>
                                                        {link.label || link.url}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {viewingTaskDetails.proofNotes && (
                                        <div>
                                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Proof Notes</h4>
                                            <div className="text-sm bg-muted/30 p-4 rounded-xl whitespace-pre-wrap border border-border">
                                                {viewingTaskDetails.proofNotes}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            <div className="flex justify-end pt-4 border-t border-border mt-6 gap-2">
                                {["superadmin", "manager", "developer"].includes(currentUserRole || "") && (
                                    <Button variant="outline" className="border-border text-foreground hover:bg-muted" onClick={() => {
                                        openEditModal(viewingTaskDetails);
                                        setViewingTaskDetails(null);
                                    }}>
                                        <Pencil className="w-4 h-4 mr-2" /> Edit Task
                                    </Button>
                                )}
                                <Button className="bg-primary hover:bg-primary/90 text-black font-semibold" onClick={() => setViewingTaskDetails(null)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Task Edit Modal */}
            {editingTask && (
                <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
                    <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] sm:max-h-[85vh] p-0 flex flex-col bg-card border-border text-foreground shadow-2xl rounded-2xl overflow-hidden focus:outline-none">
                        <DialogHeader className="shrink-0 p-5 sm:p-6 pb-3 border-b border-border bg-card/95 backdrop-blur z-10">
                            <DialogTitle className="text-lg font-bold text-foreground tracking-tight">Edit Task Details</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleEditTaskSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Title</Label>
                                    <Input
                                        className="bg-background border-border focus:border-primary text-foreground text-xs sm:text-sm"
                                        value={editTaskTitle}
                                        onChange={(e) => setEditTaskTitle(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Description</Label>
                                    <Textarea
                                        className="bg-background border-border focus:border-primary resize-none text-foreground placeholder:text-muted-foreground text-xs sm:text-sm"
                                        rows={3}
                                        value={editTaskDesc}
                                        onChange={(e) => setEditTaskDesc(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Assignees</Label>
                                    <AssigneeCombobox
                                        teamMembers={teamMembers}
                                        selectedIds={editAssigneeIds}
                                        onSelectionChange={setEditAssigneeIds}
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Effort Weight</Label>
                                        <div className="flex gap-1.5">
                                            {[1, 2, 3, 5, 8].map((pts) => (
                                                <button
                                                    key={pts}
                                                    type="button"
                                                    onClick={() => setEditTaskWeight(pts)}
                                                    className={`flex-1 py-1.5 rounded-md text-xs font-mono font-bold border transition-all ${
                                                        editTaskWeight === pts
                                                            ? "bg-primary text-black border-primary shadow-xs"
                                                            : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                                                    }`}
                                                >
                                                    {pts}p
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Est. Hours</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="500"
                                            placeholder="e.g. 8"
                                            value={editTaskHours}
                                            onChange={(e) => setNewTaskHours(e.target.value)}
                                            className="bg-background border-border focus:border-primary text-foreground placeholder:text-muted-foreground text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Due Date</Label>
                                    <Input
                                        type="date"
                                        className="bg-background border-border focus:border-primary text-foreground text-xs sm:text-sm"
                                        value={editDueDate}
                                        onChange={(e) => setEditDueDate(e.target.value)}
                                    />
                                </div>

                                {/* Workload & Capacity Guardrail Alert for Edit Task */}
                                {(() => {
                                    const hours = parseInt(editTaskHours) || 0;
                                    if (editAssigneeIds.length === 0 || hours <= 0) return null;

                                    const oldHours = editingTask?.estimatedHours || 0;

                                    const warnings = editAssigneeIds
                                        .map((id) => {
                                            const member = teamMembers.find((m) => m.id === id);
                                            const totalHours = memberWorkloadMap.get(id)?.totalHours || 0;
                                            const wasAssignedBefore = editingTask?.assignees?.some((a) => a.user.id === id);
                                            const baseHours = wasAssignedBefore ? Math.max(0, totalHours - oldHours) : totalHours;
                                            const projectedHours = baseHours + hours;

                                            if (projectedHours > STANDARD_WEEKLY_CAPACITY || hours > STANDARD_WEEKLY_CAPACITY) {
                                                return {
                                                    name: member?.name || "Developer",
                                                    projectedHours,
                                                    overHours: projectedHours - STANDARD_WEEKLY_CAPACITY,
                                                    percentage: Math.round((projectedHours / STANDARD_WEEKLY_CAPACITY) * 100),
                                                };
                                            }
                                            return null;
                                        })
                                        .filter(Boolean);

                                    if (warnings.length === 0) return null;

                                    return (
                                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 space-y-1.5 animate-in fade-in duration-200">
                                            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-rose-500">
                                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                                                <span>Workload & Capacity Guardrail Alert</span>
                                            </div>
                                            {warnings.map((w, i) => (
                                                <p key={i} className="text-[11px] text-muted-foreground leading-relaxed pl-5">
                                                    Setting <strong className="text-foreground">{hours}h</strong> puts <strong className="text-foreground">{w?.name}</strong> at{" "}
                                                    <strong className="text-rose-500">{w?.projectedHours}h / {STANDARD_WEEKLY_CAPACITY}h</strong> capacity (
                                                    <span className="text-rose-500 font-bold">{w?.percentage}% allocation</span>, +{w?.overHours}h over 40h standard week).
                                                </p>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="shrink-0 p-4 sm:p-5 border-t border-border bg-card/95 backdrop-blur">
                                <Button
                                    type="submit"
                                    disabled={isSavingEdit}
                                    className="w-full bg-primary hover:bg-primary/90 text-black font-semibold text-xs sm:text-sm"
                                >
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            )}

            {/* Milestone Edit Modal */}
            <Dialog
                open={editingMilestoneId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingMilestoneId(null);
                        setEditMilestoneTitle("");
                    }
                }}
            >
                <DialogContent className="bg-card border-border text-foreground shadow-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Edit Milestone</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleUpdateMilestone} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label className="text-foreground">Milestone Title</Label>
                            <Input
                                required
                                value={editMilestoneTitle}
                                onChange={(e) => setEditMilestoneTitle(e.target.value)}
                                className="bg-background border-border text-foreground"
                                placeholder="e.g. Design Phase"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Sequence Position</Label>
                            <Select
                                value={String(editMilestoneOrder)}
                                onValueChange={(val) => setEditMilestoneOrder(parseInt(val) || 1)}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground">
                                    <SelectValue placeholder="Select sequence position" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground shadow-xl">
                                    {optimisticMilestones.map((_, idx) => (
                                        <SelectItem key={idx + 1} value={String(idx + 1)}>
                                            Position {idx + 1}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground">
                                Milestones will automatically shift to maintain unique sequence order (1, 2, 3...).
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setEditingMilestoneId(null);
                                    setEditMilestoneTitle("");
                                }}
                                className="border-border text-foreground hover:bg-muted"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSavingMilestoneEdit || !editMilestoneTitle.trim()}
                                className="bg-primary hover:bg-primary/90 text-black font-semibold shadow-xs"
                            >
                                {isSavingMilestoneEdit ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
