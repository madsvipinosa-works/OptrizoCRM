"use client";

import React, { useEffect, useState } from "react";
import { normalizeProofUrl } from "@/lib/proof-url";
import { format } from "date-fns";
import { Clock, Loader2, Pencil, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import type { PmTask } from "./PmKanbanBoard";
import { AssigneeCombobox, type TeamMemberItem } from "./AssigneeCombobox";

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
    /** PM edit (user asked 2026-11-08; not in the mockups): name, assignee, due date, description. */
    onUpdateTaskDetails?: (
        taskId: string,
        data: { title?: string; description?: string; assigneeIds?: string[]; dueDate?: Date | null }
    ) => Promise<boolean>;
    teamMembers?: TeamMemberItem[];
    // Kept so callers do not break.
    allTasks?: PmTask[];
    onRequestChanges?: (task: PmTask) => void;
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            {children}
        </section>
    );
}

/**
 * The task panel (mockups 24b developer, 26 PM review, 26a changes requested), plus PM editing.
 * Status only changes through the workflow buttons, never by hand.
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
    onUpdateTaskDetails,
    teamMembers = [],
}: TaskDetailsDrawerProps) {
    const [comment, setComment] = useState("");
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({ title: "", description: "", assigneeIds: [] as string[], due: "" });
    useEffect(() => {
        setComment("");
        setEditing(false);
    }, [task?.id]);

    if (!task) return null;

    const status = norm(task.status);
    const isManager = currentUserRole === "manager" || currentUserRole === "admin";
    const isDeveloper = currentUserRole === "developer";
    const isMine = !!currentUserId && task.assignees?.some((a) => a.user.id === currentUserId);
    const milestone = milestones.find((m) => m.id === task.milestoneId);
    const devName = task.assignees?.[0]?.user.name;
    const due = task.dueDate ? new Date(task.dueDate) : null;
    const overdue = !!due && status !== "done" && due < new Date();
    const reviewing = isManager && status === "in_review";
    const canEdit = isManager && !!onUpdateTaskDetails && status !== "done";

    const history: { what: string; when: string }[] = [];
    if (task.createdAt) history.push({ what: task.assignees?.length ? "Task created and assigned" : "Task created", when: `${format(new Date(task.createdAt), "MMM d")} · by PM` });
    if (status === "in_progress") history.push({ what: "Moved to In progress", when: `automatic, ${firstName(devName)} started work` });
    if (status === "in_review") history.push({ what: "Moved to In review", when: `automatic, ${firstName(devName)} submitted it` });
    if (status === "changes_requested") history.push({ what: "Changes requested", when: "by PM, back to the developer" });
    if (status === "done") history.push({ what: "Approved and moved to Done", when: "by PM" });

    const startEdit = () => {
        setDraft({
            title: task.title,
            description: task.description || "",
            assigneeIds: task.assignees?.map((a) => a.user.id) ?? [],
            due: due ? format(due, "yyyy-MM-dd") : "",
        });
        setEditing(true);
    };

    const saveEdit = async () => {
        if (!onUpdateTaskDetails || !draft.title.trim()) return;
        setSaving(true);
        const ok = await onUpdateTaskDetails(task.id, {
            title: draft.title.trim(),
            description: draft.description.trim(),
            assigneeIds: draft.assigneeIds,
            dueDate: draft.due ? new Date(draft.due) : null,
        });
        setSaving(false);
        if (ok) setEditing(false);
    };

    const requestChanges = async () => {
        if (!onRequestChangesWithComment || !comment.trim()) return;
        setSaving(true);
        const ok = await onRequestChangesWithComment(task, comment.trim());
        setSaving(false);
        if (ok) onClose();
    };

    const devAction = isDeveloper && isMine && (status === "to_do" || status === "in_progress" || status === "changes_requested");

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[540px] [&>button.absolute]:hidden">
                {/* Header: where it belongs, the task, its state. */}
                <header className="shrink-0 border-b border-border px-6 pt-5 pb-5">
                    <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm text-muted-foreground">Task · {milestone?.title || "Milestone"}</p>
                        <div className="flex shrink-0 items-center gap-1.5">
                            {canEdit && !editing && (
                                <Button variant="outline" size="sm" onClick={startEdit} className="h-8 gap-1.5 bg-card px-3 text-sm active:scale-[0.97]">
                                    <Pencil className="size-3.5" aria-hidden="true" /> Edit
                                </Button>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <X className="size-4" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                    <SheetTitle className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{editing ? "Edit task" : task.title}</SheetTitle>
                    <SheetDescription className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-semibold", STATUS[status].tone)}>{STATUS[status].label}</span>
                        {isDeveloper ? "Status changes when you act" : "Status is set automatically"}
                    </SheetDescription>
                </header>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                    {editing ? (
                        <>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-task-name" className="text-sm text-muted-foreground">Task name <span className="text-destructive" aria-hidden="true">*</span></Label>
                                <Input
                                    id="edit-task-name"
                                    value={draft.title}
                                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                                    className="h-10 bg-card text-sm"
                                    autoFocus
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="min-w-0 space-y-1.5">
                                    <Label className="text-sm text-muted-foreground">Assign to</Label>
                                    <AssigneeCombobox
                                        teamMembers={teamMembers}
                                        selectedIds={draft.assigneeIds}
                                        onSelectionChange={(ids) => setDraft((d) => ({ ...d, assigneeIds: ids }))}
                                        placeholder="Pick a developer"
                                    />
                                </div>
                                <div className="min-w-0 space-y-1.5">
                                    <Label className="text-sm text-muted-foreground">Due date</Label>
                                    <DatePicker value={draft.due} onChange={(v) => setDraft((d) => ({ ...d, due: v }))} className="bg-card text-sm" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-task-desc" className="text-sm text-muted-foreground">Description</Label>
                                <Textarea
                                    id="edit-task-desc"
                                    rows={5}
                                    value={draft.description}
                                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                                    className="resize-y bg-card text-sm"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Who and when (mockup 26: Assigned to | Due). */}
                            <dl className="grid grid-cols-2 gap-4 rounded-xl bg-muted/50 p-4 text-sm">
                                <div className="min-w-0">
                                    <dt className="text-muted-foreground">{isDeveloper ? "Assigned by" : "Assigned to"}</dt>
                                    <dd className="mt-1.5">
                                        {isDeveloper ? (
                                            <span className="text-base text-foreground">Project Manager</span>
                                        ) : task.assignees?.length ? (
                                            <ul className="space-y-1.5">
                                                {task.assignees.map((a) => (
                                                    <li key={a.user.id} className="flex items-center gap-2 text-base text-foreground">
                                                        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep">
                                                            {(a.user.name || a.user.email || "D").trim()[0].toUpperCase()}
                                                        </span>
                                                        <span className="truncate">{firstName(a.user.name || a.user.email)} (Developer)</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span className="text-base text-muted-foreground">
                                                Not assigned yet
                                                {canEdit && (
                                                    <button type="button" onClick={startEdit} className="ml-2 text-sm font-semibold text-brand-deep outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                                                        Assign
                                                    </button>
                                                )}
                                            </span>
                                        )}
                                    </dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-muted-foreground">Due</dt>
                                    <dd className="mt-1.5">
                                        {due ? (
                                            <span className={cn("inline-flex items-center gap-1.5 text-base tabular-nums", overdue ? "font-medium text-destructive" : "text-foreground")}>
                                                <Clock className="size-4" aria-hidden="true" />
                                                {format(due, "MMM d")}
                                                {overdue && <span className="text-sm">· overdue</span>}
                                            </span>
                                        ) : (
                                            <span className="text-base text-muted-foreground">
                                                No due date
                                                {canEdit && (
                                                    <button type="button" onClick={startEdit} className="ml-2 text-sm font-semibold text-brand-deep outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                                                        Set date
                                                    </button>
                                                )}
                                            </span>
                                        )}
                                    </dd>
                                </div>
                            </dl>

                            {status === "changes_requested" && task.reviewNote && (
                                <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-foreground">
                                    <span className="font-semibold text-destructive">Changes requested:</span> {task.reviewNote}
                                </div>
                            )}

                            <Section title="Description">
                                <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                                    {task.description || <span className="text-muted-foreground">No description yet.</span>}
                                </p>
                            </Section>

                            {(task.proofLinks?.length || task.proofNotes) && (
                                <Section title="Submitted work">
                                    {task.proofLinks && task.proofLinks.length > 0 && (
                                        <ul className="space-y-2">
                                            {task.proofLinks.map((link, i) => (
                                                <li key={`${link.url}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-base text-foreground">{link.label || link.url}</p>
                                                        <p className="truncate text-sm text-muted-foreground">
                                                            {normalizeProofUrl(link.url) ? `Submitted by ${firstName(devName)}` : `"${link.url}" is not a full link. Ask ${firstName(devName)} to resubmit.`}
                                                        </p>
                                                    </div>
                                                    {normalizeProofUrl(link.url) ? (
                                                        <a
                                                            href={normalizeProofUrl(link.url) as string}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="shrink-0 rounded-md px-2 py-1.5 text-sm font-semibold text-brand-deep outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                                                        >
                                                            View<span className="sr-only"> {link.label || "submitted work"}</span>
                                                        </a>
                                                    ) : (
                                                        <span className="shrink-0 text-sm text-muted-foreground" title={link.url}>
                                                            Can&apos;t open
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {task.proofNotes && (
                                        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">Developer note: {task.proofNotes}</p>
                                    )}
                                </Section>
                            )}

                            {isManager && history.length > 0 && (
                                <Section title="History">
                                    <ol className="relative ml-1 space-y-4 border-l border-border pl-5">
                                        {history.map((h, i) => (
                                            <li key={h.what} className="relative">
                                                <span
                                                    aria-hidden="true"
                                                    className={cn(
                                                        "absolute -left-[25px] top-1.5 size-2.5 rounded-full ring-4 ring-background",
                                                        i === history.length - 1 ? "bg-brand-deep" : "bg-muted-foreground/40"
                                                    )}
                                                />
                                                <p className="text-base text-foreground">{h.what}</p>
                                                <p className="text-sm text-muted-foreground">{h.when}</p>
                                            </li>
                                        ))}
                                    </ol>
                                </Section>
                            )}

                            {reviewing && (
                                <div className="space-y-1.5">
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
                        </>
                    )}
                </div>

                {/* Bottom actions: Save while editing, otherwise the one workflow action for this person and state. */}
                {(editing || reviewing || devAction) && (
                    <div className="flex shrink-0 gap-3 border-t border-border px-6 pt-4 pb-6">
                        {editing ? (
                            <>
                                <Button className="h-11 flex-1 text-base font-semibold active:scale-[0.97]" disabled={saving || !draft.title.trim()} onClick={saveEdit}>
                                    {saving && <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />}
                                    Save changes
                                </Button>
                                <Button variant="outline" className="h-11 bg-card px-5 text-base active:scale-[0.97]" disabled={saving} onClick={() => setEditing(false)}>
                                    Cancel
                                </Button>
                            </>
                        ) : reviewing ? (
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
