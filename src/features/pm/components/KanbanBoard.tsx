"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { updateTaskStatus, updateMilestoneStatus, createTask } from "@/features/pm/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, GripVertical, AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const COLUMNS = [
    { id: "Todo", title: "To Do" },
    { id: "In Progress", title: "In Progress" },
    { id: "Blocked", title: "Blocked" },
    { id: "Done", title: "Done" }
];

interface KanbanTask {
    id: string;
    milestoneId: string;
    title: string;
    description: string | null;
    status: "Todo" | "In Progress" | "Blocked" | "Done";
    assigneeId: string | null;
    dueDate: Date | null;
}

interface KanbanTeamMember {
    id: string;
    name: string | null;
    image: string | null;
}

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
    tasks: KanbanTask[];
}

export function KanbanBoard({ project, teamMembers, currentUserId, currentUserRole }: { project: KanbanProject; teamMembers: KanbanTeamMember[]; currentUserId?: string; currentUserRole?: string; }) {
    const [optimisticTasks, setOptimisticTasks] = useState<KanbanTask[]>(project.tasks || []);
    const [optimisticMilestones, setOptimisticMilestones] = useState<KanbanMilestone[]>(project.milestones?.sort((a, b) => a.order - b.order) || []);
    const [activeMilestoneId, setActiveMilestoneId] = useState<string>(project.milestones?.[0]?.id || "");
    const [isAddingTask, setIsAddingTask] = useState(false);
    
    // Filters
    const [filterAssignee, setFilterAssignee] = useState<string>("all"); // "all", "unassigned", or userId
    const [myTasksOnly, setMyTasksOnly] = useState<boolean>(false);

    // Edit Task State
    const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
    const [editTaskTitle, setEditTaskTitle] = useState("");
    const [editTaskDesc, setEditTaskDesc] = useState("");
    const [editAssigneeId, setEditAssigneeId] = useState<string>("unassigned");
    const [editDueDate, setEditDueDate] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Task Form state
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newAssigneeId, setNewAssigneeId] = useState<string>("unassigned");

    // Milestone State
    const [isAddingMilestone, setIsAddingMilestone] = useState(false);
    const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
    const [isSavingMilestone, setIsSavingMilestone] = useState(false);
    const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
    const [editMilestoneTitle, setEditMilestoneTitle] = useState("");
    const [isEditingMilestone, setIsEditingMilestone] = useState(false);

    const activeMilestone = optimisticMilestones?.find((m) => m.id === activeMilestoneId);
    if (!activeMilestone && optimisticMilestones.length > 0) {
        setActiveMilestoneId(optimisticMilestones[0].id);
    }
    
    let tasksForMilestone = optimisticTasks.filter((t) => t.milestoneId === activeMilestoneId);
    
    // Apply Filters
    if (myTasksOnly && currentUserId) {
        tasksForMilestone = tasksForMilestone.filter(t => t.assigneeId === currentUserId);
    } else if (filterAssignee !== "all") {
        if (filterAssignee === "unassigned") {
            tasksForMilestone = tasksForMilestone.filter(t => !t.assigneeId);
        } else {
            tasksForMilestone = tasksForMilestone.filter(t => t.assigneeId === filterAssignee);
        }
    }

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!activeMilestone) return;

        // Dropped outside a valid droppable
        if (!destination) return;

        // Dropped in the same place
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId as KanbanTask["status"];

        // Block manual move to/from "Blocked" if the milestone itself is blocking them
        if (activeMilestone.status === "Client Approval" && newStatus !== "Blocked") {
            toast.error("Cannot unblock task while Milestone is awaiting Client Approval.");
            return;
        }

        // Optimistic UI Update
        const updatedTasks = optimisticTasks.map((t) =>
            t.id === draggableId ? { ...t, status: newStatus } : t
        );
        setOptimisticTasks(updatedTasks);

        const res = await updateTaskStatus(draggableId, newStatus);
        if (!res.success) {
            toast.error(res.message);
            // Revert on failure
            setOptimisticTasks(optimisticTasks);
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeMilestone) return;
        setIsAddingTask(true);
        const assigneeToSubmit = newAssigneeId === "unassigned" ? undefined : newAssigneeId;
        const res = await createTask(project.id, activeMilestoneId, newTaskTitle, newTaskDesc, assigneeToSubmit);
        if (res.success && res.task) {
            toast.success("Task added");
            setOptimisticTasks([...optimisticTasks, res.task as unknown as KanbanTask]);
            setNewTaskTitle("");
            setNewTaskDesc("");
            setNewAssigneeId("unassigned");
        } else {
            toast.error(res.message);
        }
        setIsAddingTask(false);
    };

    const openEditModal = (task: KanbanTask) => {
        setEditingTask(task);
        setEditTaskTitle(task.title);
        setEditTaskDesc(task.description || "");
        setEditAssigneeId(task.assigneeId || "unassigned");
        setEditDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : "");
    };

    const handleEditTaskSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTask) return;
        setIsSavingEdit(true);

        const assigneeToSubmit = editAssigneeId === "unassigned" ? null : editAssigneeId;
        const dueToSubmit = editDueDate ? new Date(editDueDate) : null;

        // Optimistic UI Update
        const updatedTasks = optimisticTasks.map(t =>
            t.id === editingTask.id ? {
                ...t,
                title: editTaskTitle,
                description: editTaskDesc,
                assigneeId: assigneeToSubmit,
                dueDate: dueToSubmit
            } : t
        );
        setOptimisticTasks(updatedTasks);
        setEditingTask(null);

        // Dynamically import to avoid polluting the top scope if it's unused elsewhere
        const { updateTaskDetails } = await import("@/features/pm/actions");
        const res = await updateTaskDetails(editingTask.id, {
            title: editTaskTitle,
            description: editTaskDesc,
            assigneeId: assigneeToSubmit,
            dueDate: dueToSubmit
        });

        if (!res.success) {
            toast.error(res.message);
            // Revert on failure (simplified revert, ideally we'd store the specific old task)
            setOptimisticTasks(optimisticTasks);
        } else {
            toast.success("Task updated");
        }
        setIsSavingEdit(false);
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm("Are you sure you want to delete this task?")) return;

        // Optimistic UI Delete
        const updatedTasks = optimisticTasks.filter(t => t.id !== taskId);
        setOptimisticTasks(updatedTasks);

        const { deleteTask } = await import("@/features/pm/actions");
        const res = await deleteTask(taskId);
        if (!res.success) {
            toast.error(res.message);
            setOptimisticTasks(optimisticTasks); // Revert
        } else {
            toast.success("Task deleted");
        }
    };

    const handleCreateMilestone = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingMilestone(true);
        const { createMilestone } = await import("@/features/pm/actions");
        const res = await createMilestone(project.id, newMilestoneTitle);
        if (res.success && res.milestone) {
            toast.success("Milestone created.");
            const newM = res.milestone as unknown as KanbanMilestone;
            setOptimisticMilestones(prev => [...prev, newM]);
            setActiveMilestoneId(newM.id);
            setNewMilestoneTitle("");
            setIsAddingMilestone(false);
        } else {
            toast.error(res.message);
        }
        setIsSavingMilestone(false);
    };

    const handleEditMilestoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMilestoneId) return;
        setIsEditingMilestone(true);
        const updated = optimisticMilestones.map(m => m.id === editingMilestoneId ? { ...m, title: editMilestoneTitle } : m);
        setOptimisticMilestones(updated);

        const { editMilestone } = await import("@/features/pm/actions");
        const res = await editMilestone(editingMilestoneId, editMilestoneTitle);
        if (!res.success) {
            toast.error(res.message);
            setOptimisticMilestones(optimisticMilestones);
        } else {
            toast.success("Milestone updated.");
        }
        setEditingMilestoneId(null);
        setIsEditingMilestone(false);
    };

    const handleDeleteMilestone = async (id: string) => {
        if (!confirm("Are you sure you want to delete this Milestone? All tasks within will be deleted.")) return;

        setOptimisticMilestones(optimisticMilestones.filter(m => m.id !== id));
        if (activeMilestoneId === id) {
            setActiveMilestoneId(optimisticMilestones.find(m => m.id !== id)?.id || "");
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
        const res = await updateMilestoneStatus(activeMilestoneId, newStatus as KanbanMilestone["status"]);
        if (res.success) {
            // Update optimistic milestone
            const updated = optimisticMilestones.map(m => m.id === activeMilestoneId ? { ...m, status: newStatus as KanbanMilestone["status"] } : m);
            setOptimisticMilestones(updated);

            if (newStatus === "Client Approval") {
                toast.warning("Milestone requires Client Approval. All active tasks inside are now Blocked.", { duration: 5000 });
                // Optimistically block tasks
                setOptimisticTasks(optimisticTasks.map((t) =>
                    (t.milestoneId === activeMilestoneId && t.status === "In Progress") ? { ...t, status: "Blocked" } : t
                ));
            } else if (activeMilestone.status === "Client Approval") {
                toast.success("Client Approved. Tasks unblocked.");
                setOptimisticTasks(optimisticTasks.map((t) =>
                    (t.milestoneId === activeMilestoneId && t.status === "Blocked") ? { ...t, status: "Todo" } : t
                ));
            } else {
                toast.success(`Milestone status updated to ${newStatus}`);
            }
        }
    };

    if (!activeMilestone) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-white/5 border border-white/10 rounded-xl mt-4">
                <h3 className="text-xl font-bold mb-2">No Milestones</h3>
                <p className="text-muted-foreground mb-4">Create a milestone to start organizing your project tasks.</p>
                {currentUserRole === "admin" && (
                    <Dialog open={isAddingMilestone} onOpenChange={setIsAddingMilestone}>
                        <DialogTrigger asChild>
                            <Button className="bg-primary text-black hover:bg-primary/90">
                                <Plus className="h-4 w-4 mr-2" /> Add Milestone
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="glass-card border-white/10 text-white">
                            <DialogHeader>
                                <DialogTitle>Add New Milestone</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateMilestone} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Milestone Title</Label>
                                    <Input required value={newMilestoneTitle} onChange={e => setNewMilestoneTitle(e.target.value)} className="bg-black/50 border-white/10" placeholder="e.g. Design Phase" />
                                </div>
                                <Button type="submit" disabled={isSavingMilestone} className="w-full bg-primary text-black hover:bg-primary/90">Create Milestone</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col pt-4">
            {/* Milestone Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 shrink-0 items-center">
                {optimisticMilestones.map((m) => (
                    <button
                        key={m.id}
                        onClick={() => setActiveMilestoneId(m.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${activeMilestoneId === m.id
                            ? 'bg-primary text-black border-primary'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 text-muted-foreground'
                            }`}
                    >
                        {m.order}. {m.title}
                    </button>
                ))}

                {currentUserRole === "admin" && (
                    <Dialog open={isAddingMilestone} onOpenChange={setIsAddingMilestone}>
                        <DialogTrigger asChild>
                            <button className="px-3 py-2 rounded-lg text-sm font-medium border border-white/10 hover:bg-white/10 text-muted-foreground whitespace-nowrap flex items-center gap-1 transition-all shrink-0">
                                <Plus className="h-4 w-4" /> Add
                            </button>
                        </DialogTrigger>
                        <DialogContent className="glass-card border-white/10 text-white">
                            <DialogHeader>
                                <DialogTitle>Add New Milestone</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateMilestone} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Milestone Title</Label>
                                    <Input required value={newMilestoneTitle} onChange={e => setNewMilestoneTitle(e.target.value)} className="bg-black/50 border-white/10" placeholder="e.g. Design Phase" />
                                </div>
                                <Button type="submit" disabled={isSavingMilestone} className="w-full bg-primary text-black hover:bg-primary/90">Create Milestone</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Active Milestone Context Bar */}
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10 mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold flex items-center gap-2">
                        {activeMilestone.title}
                        {currentUserRole === "admin" && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 hover:opacity-100">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-more-vertical"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-40">
                                    <DropdownMenuItem onClick={() => {
                                        setEditingMilestoneId(activeMilestone.id);
                                        setEditMilestoneTitle(activeMilestone.title);
                                    }}>Edit Title</DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-500" onClick={() => handleDeleteMilestone(activeMilestone.id)}>Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </h3>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Badge variant="outline" className={`cursor-pointer transition-colors px-3 py-1 flex items-center gap-1 ${activeMilestone.status === "Completed" ? "border-green-500 text-green-500 hover:bg-green-500/10" :
                                activeMilestone.status === "Client Approval" ? "border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 animate-pulse" :
                                    activeMilestone.status === "In Progress" ? "border-primary text-primary hover:bg-primary/10" :
                                        "hover:bg-white/10"
                                }`} title="Click to change status">
                                {activeMilestone.status}
                                <ChevronDown className="h-3 w-3 opacity-70" />
                            </Badge>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleMilestoneStatusChange("Pending")}>Pending</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMilestoneStatusChange("In Progress")}>In Progress</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMilestoneStatusChange("Client Approval")}>Client Approval</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMilestoneStatusChange("Completed")}>Completed</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Feedback History Toggle/List */}
                {activeMilestone.feedback && activeMilestone.feedback.length > 0 && (
                    <div className="flex-1 max-w-md mx-4">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full justify-between border-white/10 hover:bg-white/10">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className={`h-2 w-2 rounded-full shrink-0 ${activeMilestone.feedback[0].status === "REVISION_REQUESTED" ? "bg-red-500 animate-pulse" : "bg-green-500"}`} />
                                        <span className="truncate text-xs opacity-80">
                                            {activeMilestone.feedback[0].status === "REVISION_REQUESTED" ? "Revision: " : "Approval: "}
                                            {activeMilestone.feedback[0].commentText || "No comment"}
                                        </span>
                                    </div>
                                    <ChevronDown className="h-3 w-3 opacity-50 shrink-0 ml-2" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="w-80 glass-card border-white/10 p-2">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1 mb-1 border-b border-white/5">Client Feedback History</h4>
                                <div className="max-h-[300px] overflow-y-auto space-y-2 p-1">
                                    {activeMilestone.feedback.map((fb) => (
                                        <div key={fb.id} className="p-2 rounded bg-white/5 border border-white/5">
                                            <div className="flex justify-between items-start mb-1">
                                                <Badge variant="outline" className={`text-[9px] h-4 ${fb.status === "REVISION_REQUESTED" ? "border-red-500/50 text-red-500 bg-red-500/5" : "border-green-500/50 text-green-500 bg-green-500/5"}`}>
                                                    {fb.status === "REVISION_REQUESTED" ? "REVISION" : "APPROVED"}
                                                </Badge>
                                                <span className="text-[10px] opacity-40 italic">{new Date(fb.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-white/90 leading-tight">
                                                {fb.commentText || <span className="opacity-30 italic">No comment provided</span>}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}

                <Dialog>
                    <DialogTrigger asChild>
                        <Button size="sm" className="bg-primary text-black hover:bg-primary/90">
                            <Plus className="h-4 w-4 mr-2" /> Add Task
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-card border-white/10 text-white">
                        <DialogHeader>
                            <DialogTitle>Add Task to {activeMilestone.title}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateTask} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Task Title</Label>
                                <Input
                                    className="bg-black/50 border-white/10"
                                    value={newTaskTitle}
                                    onChange={e => setNewTaskTitle(e.target.value)}
                                    placeholder="e.g. Design wireframes"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Description (Optional)</Label>
                                <Textarea
                                    className="bg-black/50 border-white/10"
                                    value={newTaskDesc}
                                    onChange={e => setNewTaskDesc(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Assignee (Optional)</Label>
                                <Select value={newAssigneeId} onValueChange={setNewAssigneeId}>
                                    <SelectTrigger className="bg-black/50 border-white/10">
                                        <SelectValue placeholder="Select team member" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {teamMembers.map(member => (
                                            <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="submit" disabled={isAddingTask} className="w-full bg-primary text-black hover:bg-primary/90">
                                Create Task
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
            
            {/* Task Filters */}
            <div className="flex items-center gap-4 mb-6 bg-white/5 p-3 rounded-lg border border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Assignee:</Label>
                    <Select value={filterAssignee} onValueChange={(val) => {
                        setFilterAssignee(val);
                        if (val !== "all") setMyTasksOnly(false);
                    }}>
                        <SelectTrigger className="w-[180px] h-8 bg-black/50 border-white/10 text-sm">
                            <SelectValue placeholder="All Tasks" />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-white/10">
                            <SelectItem value="all">All Assignees</SelectItem>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {teamMembers.map(member => (
                                <SelectItem key={member.id} value={member.id}>{member.name || member.id}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                {currentUserId && (
                    <div className="flex items-center gap-2">
                        <Button 
                            variant={myTasksOnly ? "default" : "outline"} 
                            size="sm" 
                            className={`h-8 text-xs ${myTasksOnly ? 'bg-primary text-black' : 'border-white/10'}`}
                            onClick={() => {
                                setMyTasksOnly(!myTasksOnly);
                                if (!myTasksOnly) setFilterAssignee("all");
                            }}
                        >
                            My Tasks
                        </Button>
                    </div>
                )}
            </div>

            {/* Kanban Columns */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-4 h-full overflow-x-auto pb-4 shrink-0 min-h-0">
                    {COLUMNS.map(column => (
                        <div key={column.id} className="flex-1 min-w-[300px] flex flex-col bg-black/40 rounded-xl border border-white/5 p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-muted-foreground flex items-center gap-2">
                                    {column.id === 'Blocked' && <AlertCircle className="h-4 w-4 text-red-500" />}
                                    {column.id === 'Done' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                    {column.title}
                                </h4>
                                <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full">
                                    {tasksForMilestone.filter((t) => t.status === column.id).length}
                                </span>
                            </div>

                            <Droppable droppableId={column.id}>
                                {(provided, snapshot) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className={`flex-1 min-h-[150px] transition-colors rounded-lg ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
                                    >
                                        <div className="space-y-3">
                                            {tasksForMilestone
                                                .filter((t) => t.status === column.id)
                                                .map((task, index: number) => (
                                                    <Draggable key={task.id} draggableId={task.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                className={`p-3 rounded-lg border flex gap-2 transition-all ${snapshot.isDragging ? 'shadow-2xl shadow-primary/20 bg-zinc-900 border-primary/50' :
                                                                    column.id === 'Blocked' ? 'bg-red-500/10 border-red-500/20 shadow-none' :
                                                                        column.id === 'Done' ? 'bg-green-500/5 border-green-500/20 shadow-none opacity-80' :
                                                                            'glass-card border-white/10 shadow-none hover:border-white/20'
                                                                    }`}
                                                            >
                                                                <GripVertical className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                                                                <div className="flex-1 flex justify-between items-start gap-2">
                                                                    <div className="flex-1">
                                                                        <p className="font-medium text-sm leading-tight mb-1">{task.title}</p>
                                                                        {task.description && (
                                                                            <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                                                                        )}
                                                                        {task.assigneeId && (
                                                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2">
                                                                                <div className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                                                                                    {teamMembers.find(m => m.id === task.assigneeId)?.name?.[0] || 'U'}
                                                                                </div>
                                                                                {teamMembers.find(m => m.id === task.assigneeId)?.name}
                                                                            </div>
                                                                        )}
                                                                        {task.dueDate && (
                                                                            <Badge variant="outline" className={`text-[10px] h-4 leading-none bg-black border-white/10 flex items-center gap-1 ${
                                                                                task.status !== "Done" && new Date(task.dueDate) < new Date() 
                                                                                ? "text-red-500 border-red-500 bg-red-500/10 font-bold animate-pulse" 
                                                                                : "text-muted-foreground"
                                                                            }`}>
                                                                                {task.status !== "Done" && new Date(task.dueDate) < new Date() && <AlertCircle className="h-3 w-3" />}
                                                                                {new Date(task.dueDate).toLocaleDateString()}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-50 hover:opacity-100">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-more-vertical h-3 w-3"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className="w-40">
                                                                            <DropdownMenuItem onClick={() => openEditModal(task)}>Edit Task</DropdownMenuItem>
                                                                            {currentUserRole === "admin" && (
                                                                                <DropdownMenuItem className="text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDeleteTask(task.id)}>Delete Task</DropdownMenuItem>
                                                                            )}
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                            {provided.placeholder}
                                        </div>
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>

            {/* Edit Task Dialog */}
            <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
                <DialogContent className="glass-card border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Edit Task</DialogTitle>
                    </DialogHeader>
                    {editingTask && (
                        <form onSubmit={handleEditTaskSubmit} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Task Title</Label>
                                <Input
                                    className="bg-black/50 border-white/10"
                                    value={editTaskTitle}
                                    onChange={e => setEditTaskTitle(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                    className="bg-black/50 border-white/10"
                                    value={editTaskDesc}
                                    onChange={e => setEditTaskDesc(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Assignee</Label>
                                    <Select value={editAssigneeId} onValueChange={setEditAssigneeId}>
                                        <SelectTrigger className="bg-black/50 border-white/10">
                                            <SelectValue placeholder="Unassigned" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {teamMembers.map(member => (
                                                <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Due Date</Label>
                                    <Input
                                        type="date"
                                        className="bg-black/50 border-white/10"
                                        value={editDueDate}
                                        onChange={e => setEditDueDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="ghost" onClick={() => setEditingTask(null)}>Cancel</Button>
                                <Button type="submit" disabled={isSavingEdit} className="bg-primary text-black hover:bg-primary/90">
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit Milestone Dialog */}
            <Dialog open={!!editingMilestoneId} onOpenChange={(open) => !open && setEditingMilestoneId(null)}>
                <DialogContent className="glass-card border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Edit Milestone</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEditMilestoneSubmit} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Milestone Title</Label>
                            <Input
                                className="bg-black/50 border-white/10"
                                value={editMilestoneTitle}
                                onChange={e => setEditMilestoneTitle(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setEditingMilestoneId(null)}>Cancel</Button>
                            <Button type="submit" disabled={isEditingMilestone} className="bg-primary text-black hover:bg-primary/90">
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
