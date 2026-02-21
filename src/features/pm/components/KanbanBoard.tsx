"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { updateTaskStatus, updateMilestoneStatus, createTask } from "@/features/pm/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, GripVertical, AlertCircle, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
}

interface KanbanMilestone {
    id: string;
    order: number;
    title: string;
    status: "Pending" | "In Progress" | "Client Approval" | "Completed";
}

interface KanbanProject {
    id: string;
    milestones: KanbanMilestone[];
    tasks: KanbanTask[];
}

export function KanbanBoard({ project }: { project: KanbanProject; teamMembers: unknown[] }) {
    const [optimisticTasks, setOptimisticTasks] = useState<KanbanTask[]>(project.tasks || []);
    const [activeMilestoneId, setActiveMilestoneId] = useState<string>(project.milestones?.[0]?.id || "");
    const [isAddingTask, setIsAddingTask] = useState(false);

    // Form state
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");

    const activeMilestone = project.milestones?.find((m) => m.id === activeMilestoneId);
    if (!activeMilestone) return <div>No milestones found.</div>;

    const tasksForMilestone = optimisticTasks.filter((t) => t.milestoneId === activeMilestoneId);

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

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
        setIsAddingTask(true);
        const res = await createTask(project.id, activeMilestoneId, newTaskTitle, newTaskDesc);
        if (res.success) {
            toast.success("Task added");
            setNewTaskTitle("");
            setNewTaskDesc("");
            // In a real app we'd get the returned task, but for now parent page will revalidate
        } else {
            toast.error(res.message);
        }
        setIsAddingTask(false);
    };

    const nextMilestoneStatus = (current: string) => {
        if (current === "Pending") return "In Progress";
        if (current === "In Progress") return "Client Approval";
        if (current === "Client Approval") return "Completed";
        return "Pending";
    };

    const cycleMilestoneStatus = async () => {
        const newStatus = nextMilestoneStatus(activeMilestone.status);
        const res = await updateMilestoneStatus(activeMilestoneId, newStatus as KanbanMilestone["status"]);
        if (res.success) {
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

    return (
        <div className="h-full flex flex-col pt-4">
            {/* Milestone Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 shrink-0">
                {project.milestones.map((m) => (
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
            </div>

            {/* Active Milestone Context Bar */}
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10 mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold">{activeMilestone.title}</h3>
                    <Badge variant="outline" className={`cursor-pointer transition-colors ${activeMilestone.status === "Completed" ? "border-green-500 text-green-500 hover:bg-green-500/10" :
                        activeMilestone.status === "Client Approval" ? "border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 animate-pulse" :
                            activeMilestone.status === "In Progress" ? "border-primary text-primary hover:bg-primary/10" :
                                "hover:bg-white/10"
                        }`} onClick={cycleMilestoneStatus} title="Click to cycle status">
                        {activeMilestone.status}
                    </Badge>
                </div>

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
                            <Button type="submit" disabled={isAddingTask} className="w-full bg-primary text-black hover:bg-primary/90">
                                Create Task
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
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
                                                                <div>
                                                                    <p className="font-medium text-sm leading-tight mb-1">{task.title}</p>
                                                                    {task.description && (
                                                                        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                        </div>
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>
        </div>
    );
}
