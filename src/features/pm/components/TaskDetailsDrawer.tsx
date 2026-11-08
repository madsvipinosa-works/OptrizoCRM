"use client";

import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PmTask } from "./PmKanbanBoard";
import type { TeamMemberItem } from "./AssigneeCombobox";

interface TaskDetailsDrawerProps {
    task: PmTask | null;
    isOpen: boolean;
    onClose: () => void;
    milestones: { id: string; title: string; order: number; status: string }[];
    currentUserId?: string;
    currentUserRole?: string;
    onStartTask?: (taskId: string) => void;
    onSubmitTask?: (task: PmTask) => void;
    onApproveTask?: (taskId: string) => void;
    /** Mockup 26: the PM's comment is typed in the panel; resolves true when saved. */
    onRequestChangesWithComment?: (task: PmTask, comment: string) => Promise<boolean>;
    // Kept so callers do not break; the mockup panel has no editing (mockups 24b, 26).
    teamMembers?: TeamMemberItem[];
    allTasks?: PmTask[];
    onRequestChanges?: (task: PmTask) => void;
    onUpdateTaskDetails?: (...args: never[]) => Promise<boolean>;
    onDeleteTask?: (task: PmTask) => void;
    onSelectTask?: (task: PmTask) => void;
}

type Norm = "backlog" | "to_do" | "in_progress" | "changes_requested" | "in_review" | "done";

const norm = (s: PmTask["status"]): Norm => {
    const v = String(s).toLowerCase().replace(/\s+/g, "_");
    if (v === "todo") return "to_do";
    return (["backlog", "to_do", "in_progress", "changes_requested", "in_review", "done"].includes(v) ? v : "to_do") as Norm;
};

// Status chip: one hue per state, pale tint with dark text.
const STATUS: Record<Norm, { label: string; tone: string }> = {
    backlog: { label: "Backlog", tone: "bg-muted text-muted-foreground" },
    to_do: { label: "To do", tone: "bg-muted text-foreground" },
    in_progress: { label: "In progress", tone: "bg-stage-new/15 text-stage-new" },
    changes_requested: { label: "Changes requested", tone: "bg-destructive/10 text-destructive" },
    in_review: { label: "In review", tone: "bg-stage-discovery/15 text-stage-discovery" },
    done: { label: "Done", tone: "bg-brand-soft text-brand-deep" },
};

const firstName = (name?: string | null) => (name || "the developer").split(" ")[0];

/**
 * The task panel (mockups 24b developer, 26 PM review, 26a changes requested).
 * Read-only details; the only actions are the workflow ones, so status never changes by hand.
 */
export function TaskDetailsDrawer({
    task,
    isOpen,
    onClose,
    milestones,
    currentUserId,
    currentUserRole,
    onStartTask,
    onSubmitTask,
    onApproveTask,
    onRequestChangesWithComment,
}: TaskDetailsDrawerProps) {
    const [comment, setComment] = useState("");
    const [saving, setSaving] = useState(false);
    useEffect(() => setComment(""), [task?.id]);

    if (!task) return null;

    const status = norm(task.status);
    const isManager = currentUserRole === "manager" || currentUserRole === "admin";
    const isDeveloper = currentUserRole === "developer";
    const isMine = !!currentUserId && task.assignees?.some((a) => a.user.id === currentUserId);
    const milestone = milestones.find((m) => m.id === task.milestoneId);
    const devName = task.assignees?.[0]?.user.name;
    const assignedTo = task.assignees?.length
        ? task.assignees.map((a) => `${firstName(a.user.name || a.user.email)} (Developer)`).join(", ")
        : "Not assigned yet";

    const history: { what: string; when: string }[] = [];
    if (task.createdAt) history.push({ what: task.assignees?.length ? "Task created and assigned" : "Task created", when: `${format(new Date(task.createdAt), "MMM d")} · by PM` });
    if (status === "in_progress") history.push({ what: "Moved to In progress", when: `automatic, ${firstName(devName)} started work` });
    if (status === "in_review") history.push({ what: "Moved to In review", when: `automatic, ${firstName(devName)} submitted it` });
    if (status === "changes_requested") history.push({ what: "Changes requested", when: "by PM, back to the developer" });
    if (status === "done") history.push({ what: "Approved and moved to Done", when: "by PM" });

    const reviewing = isManager && status === "in_review";

    const requestChanges = async () => {
        if (!onRequestChangesWithComment || !comment.trim()) return;
        setSaving(true);
        const ok = await onRequestChangesWithComment(task, comment.trim());
        setSaving(false);
        if (ok) onClose();
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[540px] [&>button.absolute]:hidden">
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-6 pb-4">
                    <div className="flex items-start justify-between gap-4">
                        <p className="text-sm text-muted-foreground">Task · {milestone?.title || "Milestone"}</p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="-mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            Close <X className="size-4" aria-hidden="true" />
                        </button>
                    </div>
                    <SheetTitle className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">{task.title}</SheetTitle>
                    <SheetDescription className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-semibold", STATUS[status].tone)}>{STATUS[status].label}</span>
                        {isDeveloper ? "Status changes when you act" : "Status is set automatically"}
                    </SheetDescription>

                    <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <dt className="text-muted-foreground">{isDeveloper ? "Assigned by" : "Assigned to"}</dt>
                            <dd className="mt-0.5 text-base text-foreground">{isDeveloper ? "Project Manager" : assignedTo}</dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Due</dt>
                            <dd className="mt-0.5 text-base tabular-nums text-foreground">{task.dueDate ? format(new Date(task.dueDate), "MMM d") : "No due date"}</dd>
                        </div>
                    </dl>

                    <p className="mt-5 whitespace-pre-wrap text-base leading-relaxed text-foreground">
                        {task.description || <span className="text-muted-foreground">No description.</span>}
                    </p>

                    {/* Changes requested (mockup 26a): what the PM asked for. */}
                    {status === "changes_requested" && task.reviewNote && (
                        <div className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-foreground">
                            <span className="font-semibold text-destructive">Changes requested:</span> {task.reviewNote}
                        </div>
                    )}

                    {/* Submitted files (mockup 26). */}
                    {task.proofLinks && task.proofLinks.length > 0 && (
                        <ul className="mt-5 space-y-2">
                            {task.proofLinks.map((link, i) => (
                                <li key={`${link.url}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-base text-foreground">{link.label || link.url}</p>
                                        <p className="text-sm text-muted-foreground">Submitted by {firstName(devName)}</p>
                                    </div>
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="shrink-0 rounded-md text-sm font-semibold text-brand-deep outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        View
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}
                    {task.proofNotes && (
                        <p className="mt-3 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">Developer note: {task.proofNotes}</p>
                    )}

                    {/* History (mockup 26), PM only. */}
                    {isManager && history.length > 0 && (
                        <section aria-labelledby="task-history" className="mt-6">
                            <h3 id="task-history" className="text-sm text-muted-foreground">History</h3>
                            <ol className="mt-2 space-y-3">
                                {history.map((h) => (
                                    <li key={h.what} className="flex gap-3">
                                        <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-deep" aria-hidden="true" />
                                        <div>
                                            <p className="text-base text-foreground">{h.what}</p>
                                            <p className="text-sm text-muted-foreground">{h.when}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </section>
                    )}

                    {reviewing && (
                        <div className="mt-6 space-y-1.5">
                            <Label htmlFor="review-comment" className="text-sm text-muted-foreground">
                                Comment for {firstName(devName)} (needed to request changes)
                            </Label>
                            <Textarea
                                id="review-comment"
                                rows={3}
                                maxLength={2000}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="resize-y bg-card text-sm"
                            />
                        </div>
                    )}
                </div>

                {/* The one workflow action for this person and state. */}
                {(reviewing || (isDeveloper && isMine && (status === "to_do" || status === "in_progress" || status === "changes_requested"))) && (
                    <div className="flex shrink-0 gap-3 px-6 pt-2 pb-6">
                        {reviewing ? (
                            <>
                                <Button
                                    className="h-11 flex-1 bg-brand-deep text-base font-semibold text-white hover:bg-brand-deep/90 active:scale-[0.97]"
                                    onClick={() => {
                                        onApproveTask?.(task.id);
                                        onClose();
                                    }}
                                >
                                    Approve
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-11 flex-1 bg-card text-base active:scale-[0.97]"
                                    disabled={!comment.trim() || saving}
                                    onClick={requestChanges}
                                >
                                    {saving && <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />}
                                    Request changes
                                </Button>
                            </>
                        ) : status === "to_do" ? (
                            <Button className="h-11 flex-1 text-base font-semibold active:scale-[0.97]" onClick={() => onStartTask?.(task.id)}>
                                Start work
                            </Button>
                        ) : (
                            <Button
                                className="h-11 flex-1 text-base font-semibold active:scale-[0.97]"
                                onClick={() => {
                                    onClose();
                                    onSubmitTask?.(task);
                                }}
                            >
                                {status === "changes_requested" ? "Resubmit for review" : "Submit for review"}
                            </Button>
                        )}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
