"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    startTask,
    submitTask,
    approveTask,
    requestTaskChanges,
    createTask,
    deleteTask,
    updateTaskDetails,
} from "@/features/pm/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Users, RotateCcw, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AssigneeCombobox, TeamMemberItem } from "./AssigneeCombobox";
import { PmKanbanBoard, PmTask } from "./PmKanbanBoard";
import { MilestoneStrip } from "./MilestoneStrip";
import {
    ProjectTeamDrawer,
    ProjectTeamMemberRecord,
    AvailableDeveloperUser,
    ClientInfo,
} from "./ProjectTeamDrawer";
import { TaskProofValidationModal } from "./TaskProofValidationModal";
import { TaskDeleteConfirmModal } from "./TaskDeleteConfirmModal";
import { TaskDetailsDrawer } from "./TaskDetailsDrawer";

interface KanbanMilestone {
    id: string;
    order: number;
    title: string;
    status: "Pending" | "In Progress" | "Completed";
    doneReason?: string | null;
}

interface KanbanProject {
    id: string;
    title?: string;
    status?: string;
    milestones: KanbanMilestone[];
    tasks: PmTask[];
    lead?: {
        businessName?: string | null;
        clientName?: string | null;
    } | null;
}

export function KanbanBoard({
    project,
    teamMembers,
    availableDevelopers = [],
    projectTeamRecords = [],
    currentUserId,
    currentUserRole,
    viewAll = false,
    clientInfo,
}: {
    project: KanbanProject;
    teamMembers: TeamMemberItem[];
    availableDevelopers?: AvailableDeveloperUser[];
    projectTeamRecords?: ProjectTeamMemberRecord[];
    currentUserId?: string;
    currentUserRole?: string;
    viewAll?: boolean;
    clientInfo?: ClientInfo;
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

    useEffect(() => {
        if (project.milestones) {
            setOptimisticMilestones(project.milestones.sort((a, b) => a.order - b.order));
        }
    }, [project.milestones]);

    // Active milestone selection
    const [activeMilestoneId, setActiveMilestoneId] = useState<string>(
        optimisticMilestones.find((m) => m.status === "In Progress")?.id ||
            optimisticMilestones[0]?.id ||
            ""
    );

    const activeMilestone = optimisticMilestones.find((m) => m.id === activeMilestoneId);

    // Roles and Developer View Mode
    const isManager = currentUserRole === "manager";
    const isDeveloper = currentUserRole === "developer";
    const [showAllTasks, setShowAllTasks] = useState<boolean>(viewAll);

    // Modals and Drawers
    const [teamDrawerOpen, setTeamDrawerOpen] = useState(false);
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [viewingTaskDetails, setViewingTaskDetails] = useState<PmTask | null>(null);
    const [proofingTask, setProofingTask] = useState<PmTask | null>(null);
    const [requestChangesTask, setRequestChangesTask] = useState<PmTask | null>(null);
    const [requestChangesComment, setRequestChangesComment] = useState("");
    const [isSubmittingChanges, setIsSubmittingChanges] = useState(false);
    const [deletingTask, setDeletingTask] = useState<PmTask | null>(null);

    // Create Task Form state
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);
    const [newTaskWeight, setNewTaskWeight] = useState<number>(1);
    const [newTaskHours, setNewTaskHours] = useState<string>("");
    const [newTaskDueDate, setNewTaskDueDate] = useState<string>("");
    const [isCreatingTask, setIsCreatingTask] = useState(false);

    // Active Task Details reference
    const currentViewingTask = useMemo(() => {
        if (!viewingTaskDetails) return null;
        return optimisticTasks.find((t) => t.id === viewingTaskDetails.id) || viewingTaskDetails;
    }, [viewingTaskDetails, optimisticTasks]);

    // Filter tasks by active milestone
    const milestoneTasks = useMemo(() => {
        return optimisticTasks.filter((t) => t.milestoneId === activeMilestoneId);
    }, [optimisticTasks, activeMilestoneId]);

    // Apply Developer filter (My tasks vs All tasks)
    const displayedTasks = useMemo(() => {
        if (isDeveloper && !showAllTasks) {
            return milestoneTasks.filter((t) =>
                t.assignees?.some((a) => a.user.id === currentUserId)
            );
        }
        return milestoneTasks;
    }, [milestoneTasks, isDeveloper, showAllTasks, currentUserId]);

    // Count tasks for developer
    const myMilestoneTaskCount = useMemo(() => {
        return milestoneTasks.filter((t) =>
            t.assignees?.some((a) => a.user.id === currentUserId)
        ).length;
    }, [milestoneTasks, currentUserId]);

    // -------------------------------------------------------------------------
    // Task Action Handlers
    // -------------------------------------------------------------------------

    const handleStartTask = async (taskId: string) => {
        try {
            const res = await startTask(taskId);
            if (res.success) {
                toast.success("Task started");
                setOptimisticTasks((prev) =>
                    prev.map((t) => (t.id === taskId ? { ...t, status: "in_progress" } : t))
                );
                router.refresh();
            } else {
                toast.error(res.message || "Failed to start task");
            }
        } catch (error) {
            console.error("Start task error:", error);
            toast.error("An error occurred while starting task");
        }
    };

    const handleSubmitWorkConfirm = async (
        proofLinks: { label: string; url: string }[],
        proofNotes: string,
        files?: string[]
    ) => {
        if (!proofingTask) return;
        try {
            const fileUrls = files || [];
            const linkUrls = proofLinks.filter((l) => l.label !== "File").map((l) => l.url);

            const res = await submitTask({
                taskId: proofingTask.id,
                files: fileUrls,
                links: linkUrls,
                note: proofNotes,
            });

            if (res.ok) {
                toast.success("Work submitted for review");
                setOptimisticTasks((prev) =>
                    prev.map((t) =>
                        t.id === proofingTask.id
                            ? { ...t, status: "in_review", proofLinks, proofNotes, reviewNote: null }
                            : t
                    )
                );
                setProofingTask(null);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to submit work");
            }
        } catch (error) {
            console.error("Submit work error:", error);
            toast.error("An error occurred while submitting work");
        }
    };

    const handleApproveTask = async (taskId: string) => {
        try {
            const res = await approveTask(taskId);
            if (res.success) {
                toast.success("Task approved as Done");
                setOptimisticTasks((prev) =>
                    prev.map((t) => (t.id === taskId ? { ...t, status: "done" } : t))
                );
                router.refresh();
            } else {
                toast.error(res.message || "Failed to approve task");
            }
        } catch (error) {
            console.error("Approve task error:", error);
            toast.error("An error occurred while approving task");
        }
    };

    const handleRequestChangesConfirm = async () => {
        if (!requestChangesTask) return;
        const trimmed = requestChangesComment.trim();
        if (!trimmed) {
            toast.error("Comment is required to request changes");
            return;
        }

        setIsSubmittingChanges(true);
        try {
            const res = await requestTaskChanges(requestChangesTask.id, trimmed);
            if (res.success) {
                toast.success("Changes requested");
                setOptimisticTasks((prev) =>
                    prev.map((t) =>
                        t.id === requestChangesTask.id
                            ? { ...t, status: "changes_requested", reviewNote: trimmed }
                            : t
                    )
                );
                setRequestChangesTask(null);
                setRequestChangesComment("");
                router.refresh();
            } else {
                toast.error(res.message || "Failed to request changes");
            }
        } catch (error) {
            console.error("Request changes error:", error);
            toast.error("An error occurred while requesting changes");
        } finally {
            setIsSubmittingChanges(false);
        }
    };

    const handleDeleteTaskConfirm = async () => {
        if (!deletingTask) return;
        try {
            const res = await deleteTask(deletingTask.id);
            if (res.success) {
                toast.success("Task deleted");
                setOptimisticTasks((prev) => prev.filter((t) => t.id !== deletingTask.id));
                setDeletingTask(null);
                if (viewingTaskDetails?.id === deletingTask.id) {
                    setViewingTaskDetails(null);
                }
                router.refresh();
            } else {
                toast.error(res.message || "Failed to delete task");
            }
        } catch (error) {
            console.error("Delete task error:", error);
            toast.error("An error occurred while deleting task");
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim() || !activeMilestone) return;

        if (activeMilestone.status === "Completed") {
            toast.error("Cannot add tasks to a completed milestone");
            return;
        }

        setIsCreatingTask(true);
        try {
            const hours = newTaskHours ? parseInt(newTaskHours) : undefined;

            const res = await createTask(
                project.id,
                activeMilestone.id,
                newTaskTitle.trim(),
                newTaskDesc.trim() || undefined,
                newAssigneeIds,
                newTaskWeight,
                hours
            );

            if (res.success) {
                toast.success("Task created");
                setIsAddingTask(false);
                setNewTaskTitle("");
                setNewTaskDesc("");
                setNewAssigneeIds([]);
                setNewTaskWeight(1);
                setNewTaskHours("");
                setNewTaskDueDate("");
                router.refresh();
            } else {
                toast.error(res.message || "Failed to create task");
            }
        } catch (error) {
            console.error("Create task error:", error);
            toast.error("An error occurred while creating task");
        } finally {
            setIsCreatingTask(false);
        }
    };

    const handleUpdateTaskDetails = async (
        taskId: string,
        data: {
            title?: string;
            description?: string;
            assigneeIds?: string[];
            dueDate?: Date | null;
            weight?: number;
            estimatedHours?: number | null;
            dependsOnTaskId?: string | null;
        }
    ): Promise<boolean> => {
        try {
            const res = await updateTaskDetails(taskId, {
                title: data.title,
                description: data.description,
                assigneeIds: data.assigneeIds,
                dueDate: data.dueDate ?? undefined,
                weight: data.weight,
                estimatedHours: data.estimatedHours,
                dependsOnTaskId: data.dependsOnTaskId,
            });

            if (res.success) {
                toast.success("Task updated");
                setOptimisticTasks((prev) =>
                    prev.map((t) => {
                        if (t.id !== taskId) return t;
                        return {
                            ...t,
                            ...(data.title !== undefined ? { title: data.title } : {}),
                            ...(data.description !== undefined ? { description: data.description } : {}),
                            ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
                            ...(data.weight !== undefined ? { weight: data.weight } : {}),
                            ...(data.estimatedHours !== undefined ? { estimatedHours: data.estimatedHours } : {}),
                            ...(data.dependsOnTaskId !== undefined ? { dependsOnTaskId: data.dependsOnTaskId } : {}),
                            ...(data.assigneeIds !== undefined
                                ? {
                                      assignees: data.assigneeIds.map((id) => {
                                          const member = teamMembers.find((m) => m.id === id);
                                          return {
                                              user: {
                                                  id,
                                                  name: member?.name || "Member",
                                                  image: member?.image || null,
                                                  jobTitle: member?.jobTitle || null,
                                                  role: "developer",
                                              },
                                          };
                                      }),
                                  }
                                : {}),
                        };
                    })
                );
                router.refresh();
                return true;
            } else {
                toast.error(res.message || "Failed to update task");
                return false;
            }
        } catch (error) {
            console.error("Update task details error:", error);
            toast.error("An error occurred while updating task");
            return false;
        }
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 space-y-3.5 w-full">
            {/* Top Bar Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    {/* Developer: My Tasks vs All Tasks Toggle */}
                    {isDeveloper && (
                        <div role="group" aria-label="Task view filter" className="inline-flex rounded-full border border-border p-0.5 bg-muted/40">
                            <button
                                type="button"
                                onClick={() => setShowAllTasks(false)}
                                className={`h-8 px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${
                                    !showAllTasks
                                        ? "bg-primary text-primary-foreground shadow-xs font-bold"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <span>My tasks</span>
                                <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                        !showAllTasks ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                                    }`}
                                >
                                    {myMilestoneTaskCount}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAllTasks(true)}
                                className={`h-8 px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${
                                    showAllTasks
                                        ? "bg-primary text-primary-foreground shadow-xs font-bold"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <span>All tasks</span>
                                <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                        showAllTasks ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                                    }`}
                                >
                                    {milestoneTasks.length}
                                </span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    {/* Manager: Team Drawer Button */}
                    {isManager && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold gap-1.5"
                            onClick={() => setTeamDrawerOpen(true)}
                        >
                            <Users className="w-3.5 h-3.5 text-primary" />
                            <span>Team ({projectTeamRecords.length})</span>
                        </Button>
                    )}

                    {/* Manager: Add Task Button */}
                    {isManager && (
                        <Button
                            size="sm"
                            disabled={!activeMilestone || activeMilestone.status === "Completed"}
                            className="h-8 text-xs font-semibold gap-1.5 shadow-xs"
                            onClick={() => setIsAddingTask(true)}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Task</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* 5 Sequential Milestones Strip */}
            <div className="shrink-0">
                <MilestoneStrip
                    milestones={optimisticMilestones.map((m) => ({
                        id: m.id,
                        order: m.order,
                        title: m.title,
                        status: m.status,
                        doneReason: m.doneReason,
                        taskCount: optimisticTasks.filter((t) => t.milestoneId === m.id).length,
                    }))}
                    activeMilestoneId={activeMilestoneId}
                    onSelectMilestone={setActiveMilestoneId}
                    isManager={isManager}
                    onMilestoneUpdated={() => router.refresh()}
                />
            </div>

            {/* 4-Column Kanban Board */}
            <div className="flex-1 min-h-0 flex flex-col">
                <PmKanbanBoard
                    tasks={displayedTasks}
                    teamMembers={teamMembers}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                    onStartTask={handleStartTask}
                    onSubmitTask={(task) => setProofingTask(task)}
                    onApproveTask={handleApproveTask}
                    onRequestChanges={(task) => {
                        setRequestChangesTask(task);
                        setRequestChangesComment("");
                    }}
                    onDeleteTask={(task) => setDeletingTask(task)}
                    onClickTask={(task) => setViewingTaskDetails(task)}
                    isViewOnly={isDeveloper && showAllTasks}
                />
            </div>

            {/* Task Details Drawer */}
            <TaskDetailsDrawer
                task={currentViewingTask}
                isOpen={!!viewingTaskDetails}
                onClose={() => setViewingTaskDetails(null)}
                teamMembers={teamMembers}
                milestones={optimisticMilestones}
                allTasks={optimisticTasks}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onStartTask={handleStartTask}
                onSubmitTask={(task) => {
                    setViewingTaskDetails(null);
                    setProofingTask(task);
                }}
                onApproveTask={handleApproveTask}
                onRequestChanges={(task) => {
                    setRequestChangesTask(task);
                    setRequestChangesComment("");
                }}
                onUpdateTaskDetails={handleUpdateTaskDetails}
                onDeleteTask={(task) => setDeletingTask(task)}
                onSelectTask={(task) => setViewingTaskDetails(task)}
            />

            {/* Developer Submit Work Modal */}
            <TaskProofValidationModal
                open={!!proofingTask}
                onOpenChange={(open) => !open && setProofingTask(null)}
                task={proofingTask}
                targetStatus="In Review"
                onConfirm={handleSubmitWorkConfirm}
            />

            {/* PM Project Team Modal */}
            <ProjectTeamDrawer
                projectId={project.id}
                projectTitle={project.title || "Project"}
                isOpen={teamDrawerOpen}
                onClose={() => setTeamDrawerOpen(false)}
                teamMembers={projectTeamRecords}
                availableDevelopers={availableDevelopers}
                clientInfo={clientInfo}
                isManager={isManager}
                onTeamUpdated={() => router.refresh()}
            />

            {/* Delete Task Confirmation Modal */}
            <TaskDeleteConfirmModal
                open={!!deletingTask}
                onOpenChange={(open) => !open && setDeletingTask(null)}
                taskTitle={deletingTask?.title || ""}
                onConfirm={handleDeleteTaskConfirm}
            />

            {/* PM Request Changes Comment Dialog */}
            <Dialog open={!!requestChangesTask} onOpenChange={(open) => !open && setRequestChangesTask(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                            <RotateCcw className="w-5 h-5" />
                            Request Task Changes
                        </DialogTitle>
                        <DialogDescription>
                            Provide feedback to the developer detailing what changes are required before this task can be approved.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Label htmlFor="review-note" className="text-xs font-semibold">
                            Review Comment <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="review-note"
                            rows={4}
                            placeholder="e.g. Please update the responsive layout on mobile screens and ensure error states are handled."
                            value={requestChangesComment}
                            onChange={(e) => setRequestChangesComment(e.target.value)}
                            maxLength={2000}
                        />
                        <p className="text-[11px] text-muted-foreground">
                            The task will move to &ldquo;Changes Requested&rdquo; (inside In Progress) with your review note attached.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRequestChangesTask(null)}
                            disabled={isSubmittingChanges}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRequestChangesConfirm}
                            disabled={isSubmittingChanges || !requestChangesComment.trim()}
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {isSubmittingChanges ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                            Request Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manager: Create Task Dialog */}
            <Dialog open={isAddingTask} onOpenChange={setIsAddingTask}>
                <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] sm:max-h-[85vh] p-0 flex flex-col bg-card border-border text-foreground shadow-2xl rounded-2xl overflow-hidden focus:outline-none">
                    <DialogHeader className="shrink-0 p-5 sm:p-6 pb-3 border-b border-border bg-card/95 backdrop-blur z-10">
                        <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                            Add Task to {activeMilestone?.title || "Milestone"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateTask} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                    Task Title <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    className="bg-background border-border focus:border-primary text-foreground placeholder:text-muted-foreground text-xs sm:text-sm"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    placeholder="e.g. Implement OAuth Flow"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                    Description (Optional)
                                </Label>
                                <Textarea
                                    className="bg-background border-border focus:border-primary resize-none text-foreground placeholder:text-muted-foreground text-xs sm:text-sm"
                                    rows={3}
                                    value={newTaskDesc}
                                    onChange={(e) => setNewTaskDesc(e.target.value)}
                                    placeholder="Details or deliverables for the assigned developer..."
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                        Effort Weight
                                    </Label>
                                    <div className="flex gap-1.5">
                                        {[1, 2, 3, 5, 8].map((pts) => (
                                            <button
                                                key={pts}
                                                type="button"
                                                onClick={() => setNewTaskWeight(pts)}
                                                className={`flex-1 py-1.5 rounded-md text-xs font-mono font-bold border transition-all ${
                                                    newTaskWeight === pts
                                                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                                        : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                                                }`}
                                            >
                                                {pts}p
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                        Est. Hours
                                    </Label>
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
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                    Due Date
                                </Label>
                                <Input
                                    type="date"
                                    value={newTaskDueDate}
                                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                                    className="bg-background border-border focus:border-primary text-foreground text-xs"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                    Assign Developer (Project Team)
                                </Label>
                                <AssigneeCombobox
                                    teamMembers={teamMembers}
                                    selectedIds={newAssigneeIds}
                                    onSelectionChange={setNewAssigneeIds}
                                    placeholder="Select team developer..."
                                />
                                {teamMembers.length === 0 && (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                        No developers on the project team yet. Add developers via the Team drawer first.
                                    </p>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="p-4 border-t border-border bg-card/95">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsAddingTask(false)}
                                disabled={isCreatingTask}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isCreatingTask || !newTaskTitle.trim()}
                            >
                                {isCreatingTask ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                                Create Task
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
