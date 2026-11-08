"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
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
import { Plus, Users, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { todayYmd } from "@/lib/datetime";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AssigneeCombobox, TeamMemberItem } from "./AssigneeCombobox";
import { PmKanbanBoard, PmTask } from "./PmKanbanBoard";
import { MilestoneStrip } from "./MilestoneStrip";
import { SprintBar } from "./SprintBar";
import { BacklogPanel } from "./BacklogPanel";
import { PlanSprintDialog } from "./PlanSprintDialog";
import {
    ProjectTeamDrawer,
    ProjectTeamMemberRecord,
    AvailableDeveloperUser,
    ClientInfo,
} from "./ProjectTeamDrawer";
import { TaskProofValidationModal } from "./TaskProofValidationModal";
import { TaskDeleteConfirmModal } from "./TaskDeleteConfirmModal";
import { TaskDetailsDrawer } from "./TaskDetailsDrawer";
import type { SprintWithCounts } from "@/features/sprints/queries";
import { FormSelect } from "@/components/ui/form-select";
import {
    filterBoardTasks,
    isDevelopmentMilestone,
    pickDefaultSprint,
    excludeBacklogTasks,
    isBacklogTask,
} from "@/features/sprints/task-filters";

interface KanbanMilestone {
    id: string;
    order: number;
    name?: string | null;
    title: string;
    status: "Pending" | "In Progress" | "Completed";
    startDate?: Date | string | null;
    endDate?: Date | string | null;
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
    sprints = [],
    selectedSprintId: initialSelectedSprintId = null,
    backlogTasks,
}: {
    project: KanbanProject;
    teamMembers: TeamMemberItem[];
    availableDevelopers?: AvailableDeveloperUser[];
    projectTeamRecords?: ProjectTeamMemberRecord[];
    currentUserId?: string;
    currentUserRole?: string;
    viewAll?: boolean;
    clientInfo?: ClientInfo;
    sprints?: SprintWithCounts[];
    selectedSprintId?: string | null;
    backlogTasks?: PmTask[];
}) {
    const router = useRouter();
    // Team sits in the page header (mockup 22); the slot exists only after mount.
    const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
    useEffect(() => setHeaderSlot(document.getElementById("project-header-actions")), []);
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
    const isDevelopment = isDevelopmentMilestone(activeMilestone);

    // Roles and Developer View Mode
    const isManager = currentUserRole === "manager";
    const isDeveloper = currentUserRole === "developer";
    const [showAllTasks, setShowAllTasks] = useState<boolean>(viewAll);

    // Sprint selection & Backlog panel state
    const defaultSprint = useMemo(() => pickDefaultSprint(sprints), [sprints]);
    const [selectedSprintId, setSelectedSprintId] = useState<string | null>(
        initialSelectedSprintId ?? defaultSprint?.id ?? null
    );
    const [isBacklogOpen, setIsBacklogOpen] = useState(false);
    const [isPlanSprintOpen, setIsPlanSprintOpen] = useState(false);
    const [planSprintPreselectedIds, setPlanSprintPreselectedIds] = useState<string[] | undefined>(
        undefined
    );

    useEffect(() => {
        if (initialSelectedSprintId && sprints.some((s) => s.id === initialSelectedSprintId)) {
            setSelectedSprintId(initialSelectedSprintId);
        } else if (!selectedSprintId || !sprints.some((s) => s.id === selectedSprintId)) {
            setSelectedSprintId(pickDefaultSprint(sprints)?.id ?? null);
        }
    }, [initialSelectedSprintId, sprints, selectedSprintId]);

    const handleSelectSprint = (sprintId: string) => {
        setSelectedSprintId(sprintId);
        setIsBacklogOpen(false);
        router.replace(`/dashboard/pm/${project.id}?sprint=${encodeURIComponent(sprintId)}`, {
            scroll: false,
        });
    };

    // Modals and Drawers
    const [teamDrawerOpen, setTeamDrawerOpen] = useState(false);
    // "Set up team" on the signed proposal links here with ?team=1.
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get("team") === "1") setTeamDrawerOpen(true);
    }, []);
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
    const [newTaskSprintChoice, setNewTaskSprintChoice] = useState<string>("backlog");
    const [isCreatingTask, setIsCreatingTask] = useState(false);

    // Active Task Details reference
    const currentViewingTask = useMemo(() => {
        if (!viewingTaskDetails) return null;
        return optimisticTasks.find((t) => t.id === viewingTaskDetails.id) || viewingTaskDetails;
    }, [viewingTaskDetails, optimisticTasks]);

    // Filter tasks by active milestone and sprint (in Development)
    const milestoneTasks = useMemo(() => {
        const rawMilestoneTasks = optimisticTasks.filter((t) => t.milestoneId === activeMilestoneId);
        return filterBoardTasks(rawMilestoneTasks, {
            isDevelopment,
            selectedSprintId,
        });
    }, [optimisticTasks, activeMilestoneId, isDevelopment, selectedSprintId]);

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

    // Manager-only backlog tasks
    const managerBacklogList = useMemo(() => {
        if (!isManager) return [];
        if (backlogTasks) return backlogTasks;
        return optimisticTasks.filter(
            (t) => t.milestoneId === activeMilestoneId && isBacklogTask(t)
        );
    }, [isManager, backlogTasks, optimisticTasks, activeMilestoneId]);

    const nonEndedSprints = useMemo(
        () => sprints.filter((s) => s.status !== "ended"),
        [sprints]
    );

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
            const opts = isDevelopment
                ? newTaskSprintChoice === "backlog"
                    ? { toBacklog: true }
                    : { sprintId: newTaskSprintChoice }
                : undefined;

            const res = await createTask(
                project.id,
                activeMilestone.id,
                newTaskTitle.trim(),
                newTaskDesc.trim() || undefined,
                newAssigneeIds,
                newTaskWeight,
                hours,
                opts
            );

            if (res.success) {
                toast.success(
                    isDevelopment && newTaskSprintChoice === "backlog"
                        ? "Task added to backlog"
                        : "Task created"
                );
                setIsAddingTask(false);
                setNewTaskTitle("");
                setNewTaskDesc("");
                setNewAssigneeIds([]);
                setNewTaskWeight(1);
                setNewTaskHours("");
                setNewTaskDueDate("");
                setNewTaskSprintChoice("backlog");
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
        <div className="flex flex-col flex-1 min-h-0 space-y-4 w-full">
            {/* Top Bar Controls */}
            <div className={`flex flex-wrap items-center justify-between gap-3 shrink-0 ${isDeveloper ? "" : "hidden"}`}>
                <div className="flex items-center gap-2">
                    {/* Developer: My Tasks vs All Tasks Toggle */}
                    {isDeveloper && (
                        <div role="group" aria-label="Task view filter" className="inline-flex rounded-full border border-border p-0.5 bg-muted/40">
                            <button
                                type="button"
                                onClick={() => setShowAllTasks(false)}
                                className={`h-8 px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${
 !showAllTasks
 ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <span>My tasks</span>
                                <span
                                    className={`text-xs px-1.5 py-0.2 rounded-full tabular-nums ${
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
 ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <span>All tasks</span>
                                <span
                                    className={`text-xs px-1.5 py-0.2 rounded-full tabular-nums ${
 showAllTasks ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                                    }`}
                                >
                                    {milestoneTasks.length}
                                </span>
                            </button>
                        </div>
                    )}
                </div>

                {headerSlot && createPortal(<>
                    {/* Manager: Team Drawer Button */}
                    {isManager && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 shrink-0 gap-1.5 bg-card px-3 text-sm font-medium text-foreground active:scale-[0.97]"
                            onClick={() => setTeamDrawerOpen(true)}
                        >
                            <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                            <span>Team</span>
                            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{projectTeamRecords.length}</span>
                        </Button>
                    )}

                </>, headerSlot)}
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
                        taskCount: excludeBacklogTasks(
                            optimisticTasks.filter((t) => t.milestoneId === m.id)
                        ).length,
                    }))}
                    activeMilestoneId={activeMilestoneId}
                    onSelectMilestone={(id) => {
                        setActiveMilestoneId(id);
                        setIsBacklogOpen(false);
                    }}
                    isManager={isManager}
                    onMilestoneUpdated={() => router.refresh()}
                />
            </div>

            {/* Sprint Bar in Development milestone */}
            {isDevelopment && (
                <div className="shrink-0">
                    <SprintBar
                        sprints={sprints}
                        selectedSprintId={selectedSprintId}
                        onSelectSprint={handleSelectSprint}
                        isManager={isManager}
                        backlogCount={managerBacklogList.length}
                        isBacklogOpen={isBacklogOpen}
                        onToggleBacklog={() => setIsBacklogOpen((prev) => !prev)}
                        onOpenPlanSprint={() => {
                            setPlanSprintPreselectedIds(undefined);
                            setIsPlanSprintOpen(true);
                        }}
                    />
                </div>
            )}

            {/* Main Content Area: Board or No-Sprints Empty State / Backlog Panel */}
            <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto">
                {isDevelopment && sprints.length === 0 ? (
                    <div className="flex flex-col gap-4 flex-1 min-h-0">
                        <div className="rounded-xl border border-dashed border-border bg-card/70 p-6 text-center space-y-2 shrink-0">
                            <p className="text-sm sm:text-base font-semibold text-foreground">
                                No sprint yet. Plan a sprint to start work.
                            </p>
                            {isManager && (
                                <div className="pt-1">
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setPlanSprintPreselectedIds(undefined);
                                            setIsPlanSprintOpen(true);
                                        }}
                                    >
                                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                                        Plan sprint
                                    </Button>
                                </div>
                            )}
                        </div>

                        {isManager && activeMilestone && (
                            <BacklogPanel
                                projectId={project.id}
                                developmentMilestoneId={activeMilestone.id}
                                backlogTasks={managerBacklogList}
                                sprints={sprints}
                                onAddTask={() => {
                                    setNewTaskSprintChoice("backlog");
                                    setIsAddingTask(true);
                                }}
                                onOpenPlanSprint={(ids) => {
                                    setPlanSprintPreselectedIds(ids);
                                    setIsPlanSprintOpen(true);
                                }}
                                onTasksChanged={() => router.refresh()}
                            />
                        )}
                    </div>
                ) : isDevelopment && isManager && isBacklogOpen && activeMilestone ? (
                    <BacklogPanel
                        projectId={project.id}
                        developmentMilestoneId={activeMilestone.id}
                        backlogTasks={managerBacklogList}
                        sprints={sprints}
                        onAddTask={() => {
                            setNewTaskSprintChoice("backlog");
                            setIsAddingTask(true);
                        }}
                        onOpenPlanSprint={(ids) => {
                            setPlanSprintPreselectedIds(ids);
                            setIsPlanSprintOpen(true);
                        }}
                        onTasksChanged={() => router.refresh()}
                    />
                ) : (
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
                        onAddTask={isManager && activeMilestone && activeMilestone.status !== "Completed" ? () => setIsAddingTask(true) : undefined}
                    />
                )}
            </div>

            {/* Plan Sprint Dialog (Managers Only) */}
            {isManager && (
                <PlanSprintDialog
                    open={isPlanSprintOpen}
                    onOpenChange={setIsPlanSprintOpen}
                    projectId={project.id}
                    projectTitle={project.title || "Project"}
                    existingSprintCount={sprints.length}
                    backlogTasks={managerBacklogList}
                    initialSelectedTaskIds={planSprintPreselectedIds}
                    developmentStartDate={activeMilestone?.startDate}
                    developmentEndDate={activeMilestone?.endDate}
                    onSprintPlanned={(newSprintId) => {
                        setSelectedSprintId(newSprintId);
                        setIsBacklogOpen(false);
                        router.replace(
                            `/dashboard/pm/${project.id}?sprint=${encodeURIComponent(newSprintId)}`,
                            { scroll: false }
                        );
                    }}
                />
            )}

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
                        <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">Request changes</DialogTitle>
                        <DialogDescription className="text-sm">
                            {requestChangesTask?.title}: say what needs to change before you can approve it.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Label htmlFor="review-note" className="text-sm text-muted-foreground">
                            Comment for {requestChangesTask?.assignees?.[0]?.user.name?.split(" ")[0] || "the developer"} (needed to request changes)
                        </Label>
                        <Textarea
                            id="review-note"
                            rows={4}
                            placeholder="e.g. Please update the responsive layout on mobile screens and ensure error states are handled."
                            value={requestChangesComment}
                            onChange={(e) => setRequestChangesComment(e.target.value)}
                            maxLength={2000}
                        />
                        <p className="text-sm text-muted-foreground">
                            The task moves back to In progress with your comment, and the developer is notified.
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
                            className="font-semibold active:scale-[0.97]"
                        >
                            {isSubmittingChanges ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                            Request changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manager: Create Task Dialog */}
            <Dialog open={isAddingTask} onOpenChange={setIsAddingTask}>
                <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] sm:max-h-[85vh] p-0 flex flex-col bg-card border-border text-foreground rounded-xl overflow-hidden focus:outline-none">
                    <DialogHeader className="shrink-0 p-5 sm:p-6 pb-3 border-b border-border bg-card/95 z-10">
                        <DialogTitle className="text-lg font-semibold text-foreground tracking-tight">Add task</DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            Business name: {clientInfo?.businessName || "Not given"} · Project name: {project.title}
                        </p>
                    </DialogHeader>
                    <form onSubmit={handleCreateTask} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="new-task-name" className="text-sm text-muted-foreground">
                                    Task name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="new-task-name"
                                    className="bg-card text-sm text-foreground placeholder:text-muted-foreground"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    placeholder="e.g. Draft the dispatcher dashboard wireframes"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {/* The task goes into the milestone open on the board; it cannot be changed here (mockup 22b). */}
                            <div className="space-y-1.5 min-w-0">
                                <Label htmlFor="new-task-milestone" className="text-sm text-muted-foreground">Milestone (fixed)</Label>
                                <Input id="new-task-milestone" value={activeMilestone?.title || "No milestone"} readOnly disabled className="bg-muted text-sm text-foreground" />
                            </div>
                            <div className="space-y-1.5 min-w-0">
                                <Label className="text-sm text-muted-foreground">Assign to</Label>
                                <AssigneeCombobox
                                    teamMembers={teamMembers}
                                    selectedIds={newAssigneeIds}
                                    onSelectionChange={setNewAssigneeIds}
                                    placeholder="Pick a developer on the team"
                                />
                                {teamMembers.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        No developers on the project team yet. Add them with Team first.
                                    </p>
                                )}
                            </div>
                            </div>
                            {isDevelopment && (
                                <div className="space-y-1.5">
                                    <Label className="text-sm text-muted-foreground">Sprint</Label>
                                    <FormSelect
                                        value={newTaskSprintChoice}
                                        onChange={(e) => setNewTaskSprintChoice(e.target.value)}
                                    >
                                        <option value="backlog">Backlog (no sprint yet)</option>
                                        {nonEndedSprints.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.startDate} – {s.endDate})
                                            </option>
                                        ))}
                                    </FormSelect>
                                    <p className="text-sm text-muted-foreground">
                                        Development only. Leave it in the backlog and pick it when you plan a sprint, or put it in a sprint now.
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="new-task-desc" className="text-sm text-muted-foreground">Description (optional)</Label>
                                <Textarea
                                    id="new-task-desc"
                                    className="resize-none bg-card text-sm text-foreground placeholder:text-muted-foreground"
                                    rows={3}
                                    value={newTaskDesc}
                                    onChange={(e) => setNewTaskDesc(e.target.value)}
                                    placeholder="e.g. List the screens the dispatcher needs, with a short note for each."
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-sm text-muted-foreground">Effort weight</Label>
                                    <div className="flex gap-1.5">
                                        {[1, 2, 3, 5, 8].map((pts) => (
                                            <button
                                                key={pts}
                                                type="button"
                                                onClick={() => setNewTaskWeight(pts)}
                                                aria-pressed={newTaskWeight === pts}
                                                className={`flex-1 rounded-md border py-1.5 text-sm font-semibold tabular-nums transition-[color,background-color,border-color] duration-150 ease-out ${
                                                    newTaskWeight === pts
                                                        ? "border-brand-deep/40 bg-brand-soft text-brand-deep"
                                                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                {pts}p
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm text-muted-foreground">Estimated hours</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="500"
                                        placeholder="e.g. 8"
                                        value={newTaskHours}
                                        onChange={(e) => setNewTaskHours(e.target.value)}
                                        className="bg-card text-sm text-foreground placeholder:text-muted-foreground"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm text-muted-foreground">Due date</Label>
                                <DatePicker value={newTaskDueDate} onChange={setNewTaskDueDate} min={todayYmd()} className="bg-card text-sm" />
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
                                className="font-semibold active:scale-[0.97]"
                            >
                                {isCreatingTask ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                                {isDevelopment && newTaskSprintChoice === "backlog"
                                    ? "Add to backlog"
                                    : "Add task"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
