"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatus, updateMilestoneStatus, createTask, submitTaskProofAndMove, submitTaskBlockedReasonAndMove, deleteTask, updateTaskDetails } from "@/features/pm/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Delete Task State
    const [deletingTask, setDeletingTask] = useState<PmTask | null>(null);

    // Task Form state
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);

    // Task Proof Intercept state
    const [proofingTask, setProofingTask] = useState<{
        task: PmTask;
        targetStatus: "In Review" | "Done";
    } | null>(null);

    // Task Proof Viewing state
    const [viewingProofsTask, setViewingProofsTask] = useState<PmTask | null>(null);

    // Task Blocked Intercept state
    const [blockingTask, setBlockingTask] = useState<{
        task: PmTask;
    } | null>(null);

    // Milestone State
    const [isAddingMilestone, setIsAddingMilestone] = useState(false);
    const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
    const [isSavingMilestone, setIsSavingMilestone] = useState(false);
    const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
    const [editMilestoneTitle, setEditMilestoneTitle] = useState("");

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
            toast.success("Task proof submitted & status updated!");
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
            newAssigneeIds
        );
        if (res.success && res.task) {
            toast.success("Task added");
            setOptimisticTasks([...optimisticTasks, res.task as unknown as PmTask]);
            setNewTaskTitle("");
            setNewTaskDesc("");
            setNewAssigneeIds([]);
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
    };

    const handleEditTaskSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTask) return;
        setIsSavingEdit(true);

        const dueToSubmit = editDueDate ? new Date(editDueDate) : null;

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
        });

        if (!res.success) {
            toast.error(res.message || "Failed to update task");
            setOptimisticTasks(optimisticTasks);
        } else {
            toast.success("Task details updated");
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
            <div className="flex flex-col items-center justify-center p-8 bg-zinc-900/50 border border-zinc-800 rounded-xl mt-4 text-center">
                <h3 className="text-xl font-bold mb-2 text-zinc-100">No Milestones</h3>
                <p className="text-zinc-400 mb-4">Create a milestone to start organizing your project tasks.</p>
                {["superadmin", "manager"].includes(currentUserRole || "") && (
                    <Dialog open={isAddingMilestone} onOpenChange={setIsAddingMilestone}>
                        <DialogTrigger asChild>
                            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium">
                                <Plus className="h-4 w-4 mr-2" /> Add Milestone
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                            <DialogHeader>
                                <DialogTitle>Add New Milestone</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateMilestone} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Milestone Title</Label>
                                    <Input
                                        required
                                        value={newMilestoneTitle}
                                        onChange={(e) => setNewMilestoneTitle(e.target.value)}
                                        className="bg-zinc-900 border-zinc-800"
                                        placeholder="e.g. Design Phase"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isSavingMilestone}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
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
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 shrink-0 items-center scrollbar-none">
                {optimisticMilestones.map((m) => (
                    <button
                        key={m.id}
                        onClick={() => setActiveMilestoneId(m.id)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${activeMilestoneId === m.id
                                ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
                                : "bg-zinc-900/80 border-zinc-800 hover:bg-zinc-800 text-zinc-400"
                            }`}
                    >
                        {m.order}. {m.title}
                    </button>
                ))}

                {["superadmin", "manager"].includes(currentUserRole || "") && (
                    <Dialog open={isAddingMilestone} onOpenChange={setIsAddingMilestone}>
                        <DialogTrigger asChild>
                            <button className="px-3 py-2 rounded-lg text-xs font-medium border border-zinc-800 hover:bg-zinc-800 text-zinc-400 whitespace-nowrap flex items-center gap-1 transition-all shrink-0">
                                <Plus className="h-3.5 w-3.5" /> Add
                            </button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                            <DialogHeader>
                                <DialogTitle>Add New Milestone</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateMilestone} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Milestone Title</Label>
                                    <Input
                                        required
                                        value={newMilestoneTitle}
                                        onChange={(e) => setNewMilestoneTitle(e.target.value)}
                                        className="bg-zinc-900 border-zinc-800"
                                        placeholder="e.g. Design Phase"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isSavingMilestone}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                                >
                                    Create Milestone
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Active Milestone Context Bar */}
            <div className="flex items-center justify-between bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 mb-4 shrink-0 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <h3 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
                        {activeMilestone.title}
                        {["superadmin", "manager"].includes(currentUserRole || "") && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-50 hover:opacity-100 text-zinc-400"
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
                                <DropdownMenuContent align="start" className="w-40 bg-zinc-950 border-zinc-800 text-zinc-200">
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setEditingMilestoneId(activeMilestone.id);
                                            setEditMilestoneTitle(activeMilestone.title);
                                        }}
                                    >
                                        Edit Title
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-rose-400 focus:text-rose-400 focus:bg-rose-500/10"
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
                        <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                            {activeMilestone.status}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {["superadmin", "manager"].includes(currentUserRole || "") && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20">
                                    <Plus className="h-4 w-4 mr-1.5" /> Add Task
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-[480px]">
                                <DialogHeader>
                                    <DialogTitle>Add Task to {activeMilestone.title}</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleCreateTask} className="space-y-4 pt-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Task Title</Label>
                                        <Input
                                            className="bg-zinc-900 border-zinc-800 focus:border-indigo-500"
                                            value={newTaskTitle}
                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                            placeholder="e.g. Implement OAuth Flow"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Description (Optional)</Label>
                                        <Textarea
                                            className="bg-zinc-900 border-zinc-800 focus:border-indigo-500 resize-none"
                                            rows={3}
                                            value={newTaskDesc}
                                            onChange={(e) => setNewTaskDesc(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Assign Staff</Label>
                                        <AssigneeCombobox
                                            teamMembers={teamMembers}
                                            selectedIds={newAssigneeIds}
                                            onSelectionChange={setNewAssigneeIds}
                                            placeholder="Select assigned staff..."
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={isAddingTask}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                                    >
                                        Create Task
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {/* Filter Bar */}
            {["superadmin", "manager"].includes(currentUserRole || "") && (
                <div className="flex items-center gap-4 mb-4 bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-800/60 shrink-0">
                    <div className="flex items-center gap-2">
                        <Label className="text-xs text-zinc-400 font-medium">Filter Assignee:</Label>
                        <Select
                            value={filterAssignee}
                            onValueChange={(val) => {
                                setFilterAssignee(val);
                                if (val !== "all") setMyTasksOnly(false);
                            }}
                        >
                            <SelectTrigger className="w-[180px] h-8 bg-zinc-900 border-zinc-800 text-xs text-zinc-200">
                                <SelectValue placeholder="All Tasks" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                                <SelectItem value="all">All Assignees</SelectItem>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {teamMembers.map((member) => (
                                    <SelectItem key={member.id} value={member.id}>
                                        {member.name || member.id}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {currentUserId && (
                        <Button
                            variant={myTasksOnly ? "default" : "outline"}
                            size="sm"
                            className={`h-8 text-xs ${myTasksOnly
                                    ? "bg-indigo-600 text-white border-indigo-500"
                                    : "border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                                }`}
                            onClick={() => {
                                setMyTasksOnly(!myTasksOnly);
                                if (!myTasksOnly) setFilterAssignee("all");
                            }}
                        >
                            My Tasks
                        </Button>
                    )}
                </div>
            )}

            {/* dnd-kit PmKanbanBoard */}
            <PmKanbanBoard
                tasks={tasksForMilestone}
                teamMembers={teamMembers}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onStatusChangeRequest={handleStatusChangeRequest}
                onEditTask={openEditModal}
                onDeleteTask={(task) => setDeletingTask(task)}
                onViewProofs={(task) => setViewingProofsTask(task)}
            />

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
                task={viewingProofsTask}
                targetStatus={viewingProofsTask?.status as "In Review" | "Done" || "In Review"}
                mode="edit"
                isViewOnly={
                    !(
                        ["superadmin", "manager"].includes(currentUserRole || "") ||
                        viewingProofsTask?.assignees?.some(a => a.user.id === currentUserId)
                    )
                }
                onConfirm={async (proofLinks, proofNotes) => {
                    if (!viewingProofsTask) return;
                    const res = await submitTaskProofAndMove(
                        viewingProofsTask.id,
                        viewingProofsTask.status as "In Review" | "Done",
                        proofLinks,
                        proofNotes
                    );
                    if (!res.success) {
                        toast.error(res.message || "Failed to update task proofs");
                        throw new Error(res.message || "Failed to update task proofs");
                    } else {
                        toast.success("Task proofs updated!");
                        const updated = optimisticTasks.map((t) =>
                            t.id === viewingProofsTask.id
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

            {/* Task Edit Modal */}
            {editingTask && (
                <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
                    <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-[480px]">
                        <DialogHeader>
                            <DialogTitle>Edit Task Details</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleEditTaskSubmit} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Title</Label>
                                <Input
                                    className="bg-zinc-900 border-zinc-800"
                                    value={editTaskTitle}
                                    onChange={(e) => setEditTaskTitle(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Description</Label>
                                <Textarea
                                    className="bg-zinc-900 border-zinc-800 resize-none"
                                    rows={3}
                                    value={editTaskDesc}
                                    onChange={(e) => setEditTaskDesc(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Assignees</Label>
                                <AssigneeCombobox
                                    teamMembers={teamMembers}
                                    selectedIds={editAssigneeIds}
                                    onSelectionChange={setEditAssigneeIds}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Due Date</Label>
                                <Input
                                    type="date"
                                    className="bg-zinc-900 border-zinc-800 text-zinc-200"
                                    value={editDueDate}
                                    onChange={(e) => setEditDueDate(e.target.value)}
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={isSavingEdit}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                            >
                                Save Changes
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
