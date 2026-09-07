"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    ShieldCheck,
    Link2,
    FileText,
    AlertCircle,
    Loader2,
    Edit2,
    ExternalLink,
    Cpu,
    Copy,
    Check,
    Sparkles,
    RotateCcw,
    ClipboardList,
} from "lucide-react";
import { AIAuditCard } from "@/components/tasks/ai-audit-card";
import { getTaskAuditReport } from "@/features/pm/actions";
import { polishDeliveryNotes } from "@/actions/task-quality-gate";
import { cn } from "@/lib/utils";

interface TaskProofValidationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: {
        id: string;
        title: string;
        description?: string | null;
        status?: string;
        proofLinks?: { label: string; url: string }[] | null;
        proofNotes?: string | null;
    } | null;
    targetStatus: "In Review" | "Done";
    onConfirm: (proofLinks: { label: string; url: string }[], proofNotes: string) => Promise<void>;
    mode?: "transition" | "edit";
    isViewOnly?: boolean;
    initialTab?: "proofs" | "audit";
}

export function TaskProofValidationModal({
    open,
    onOpenChange,
    task,
    targetStatus,
    onConfirm,
    mode = "transition",
    isViewOnly = false,
    initialTab = "proofs",
}: TaskProofValidationModalProps) {
    const [proofLinks, setProofLinks] = useState<{ label: string; url: string }[]>([{ label: "", url: "" }]);
    const [proofNotes, setProofNotes] = useState("");
    const [auditReport, setAuditReport] = useState<{
        summary?: string;
        criteriaBreakdown?: Array<{ criterion: string; status: string; notes?: string }>;
        gateStatus?: string;
        aiConfidenceScore?: number;
    } | null>(null);
    const [isLoadingAudit, setIsLoadingAudit] = useState(false);
    const [activeTab, setActiveTab] = useState<"proofs" | "audit">(initialTab);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // AI Polish & Template Assist state
    const [isPolishing, setIsPolishing] = useState(false);
    const [prePolishNotes, setPrePolishNotes] = useState<string | null>(null);
    const [canUndoPolish, setCanUndoPolish] = useState(false);
    const [polishError, setPolishError] = useState<string | null>(null);

    const [isEditing, setIsEditing] = useState(mode === "transition");

    useEffect(() => {
        if (open && task) {
            setProofLinks(task.proofLinks?.length ? task.proofLinks : [{ label: "", url: "" }]);
            setProofNotes(task.proofNotes || "");
            setError(null);
            setPolishError(null);
            setCanUndoPolish(false);
            setPrePolishNotes(null);
            setIsEditing(mode === "transition");
            setActiveTab(initialTab);

            // Fetch latest AI Quality Audit report for this task
            setIsLoadingAudit(true);
            getTaskAuditReport(task.id)
                .then((report) => setAuditReport(report))
                .catch(() => setAuditReport(null))
                .finally(() => setIsLoadingAudit(false));
        }
    }, [task, open, mode, initialTab]);

    const addLink = () => setProofLinks([...proofLinks, { label: "", url: "" }]);
    const removeLink = (index: number) => setProofLinks(proofLinks.filter((_, i) => i !== index));
    const updateLink = (index: number, field: "label" | "url", value: string) => {
        const newLinks = [...proofLinks];
        newLinks[index][field] = value;
        setProofLinks(newLinks);
    };

    const handleCopyUrl = (url: string, index: number) => {
        const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
        navigator.clipboard.writeText(formattedUrl);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const validLinks = proofLinks
            .filter((l) => l.url.trim() !== "" || l.label.trim() !== "")
            .map((l) => {
                let url = l.url.trim();
                let label = l.label.trim();

                // If user accidentally pasted the URL into the Label field
                if (url === "" && (label.startsWith("http") || label.includes("."))) {
                    url = label;
                    label = "Proof Link";
                }

                if (url === "") url = label; // Fallback

                if (!/^https?:\/\//i.test(url)) {
                    url = `https://${url}`;
                }
                return { label: label || "Proof Link", url };
            });

        if (validLinks.length === 0 && !proofNotes.trim()) {
            setError("Please provide at least one Proof URL or completion notes.");
            setActiveTab("proofs");
            return;
        }

        for (const link of validLinks) {
            try {
                new URL(link.url);
            } catch {
                setError(`Invalid URL format: ${link.url}`);
                setActiveTab("proofs");
                return;
            }
        }

        try {
            setIsSubmitting(true);
            await onConfirm(validLinks, proofNotes.trim());
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit task proof.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInsertTemplate = () => {
        const text = `${task?.title || ""} ${task?.description || ""}`.toLowerCase();
        const isDesign = /(figma|design|ui|ux|wireframe|mockup|banner|logo|palette|prototype)/i.test(text);
        const isMarketing = /(marketing|social media|campaign|post|reel|tweet|newsletter|ad|utm)/i.test(text);

        let template = "";
        if (isDesign) {
            template = `• Implementation: Designed components, layout states, and responsive frames.\n• Verification: Reviewed against design tokens, dark mode, and breakpoints.\n• Delivery & Artifacts: Figma frames and prototype specs updated for review.`;
        } else if (isMarketing) {
            template = `• Implementation: Produced copy, creative assets, and campaign distribution.\n• Verification: Verified tracking UTMs, audience parameters, and post schedule.\n• Delivery & Artifacts: Live post and distribution channel links ready for review.`;
        } else {
            // Engineering / General Docs
            template = `• Implementation: Built and configured feature components and logic.\n• Verification: Tested functionality, edge cases, and test suites in staging.\n• Delivery & Artifacts: Code committed with pull request ready for review.`;
        }

        if (proofNotes.trim().length === 0) {
            setProofNotes(template);
        } else {
            // Guardrail 2: Append below existing text so developers don't lose typed context
            setProofNotes((prev) => `${prev.trim()}\n\n${template}`);
        }
    };

    const handleAiPolish = async () => {
        if (!task || isPolishing || proofNotes.trim().length < 3) return;
        setIsPolishing(true);
        setPolishError(null);
        setPrePolishNotes(proofNotes);

        try {
            const validProofUrls = proofLinks
                .map((l) => l.url.trim())
                .filter((u) => u.length > 0);

            const res = await polishDeliveryNotes({
                taskId: task.id,
                taskTitle: task.title,
                taskDescription: task.description,
                rawNotes: proofNotes,
                proofUrls: validProofUrls,
            });

            if (res.success && res.polishedNotes) {
                setProofNotes(res.polishedNotes);
                setCanUndoPolish(true);
            } else {
                setPolishError(res.error || "Could not polish notes at this time.");
            }
        } catch (err) {
            setPolishError(err instanceof Error ? err.message : "AI Polish failed. Please try again.");
        } finally {
            setIsPolishing(false);
        }
    };

    const handleUndoPolish = () => {
        if (prePolishNotes !== null) {
            setProofNotes(prePolishNotes);
            setCanUndoPolish(false);
            setPrePolishNotes(null);
        }
    };

    // Live Pre-Submission Quality Readiness Computation (0ms Client Heuristic)
    const taskContextText = `${task?.title || ""} ${task?.description || ""}`.toLowerCase();
    const isMarketingTask = /(marketing|social media|campaign|post|reel|tweet|newsletter|ad|utm)/i.test(taskContextText);
    const notesLen = proofNotes.trim().length;
    const hasSubstantiveTerms = /(implement|tested|verify|fix|deploy|build|schema|api|endpoint|component|route|database|ui|review|auth|campaign|published|utm|branding|overlay|tracking|metric|engagement|copy|design|release|edit)/i.test(
        proofNotes
    );

    const primaryLink = proofLinks.find((l) => l.url.trim().length > 0)?.url.trim() || "";
    let isUrlAcceptable = false;
    let urlLabel = "No URL provided";
    let isUrlBlocked = false;

    if (primaryLink) {
        try {
            const formatted = primaryLink.startsWith("http") ? primaryLink : `https://${primaryLink}`;
            const parsed = new URL(formatted);
            const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
            const path = parsed.pathname.trim();
            const isRoot = path === "" || path === "/";

            const isShorts = (host.includes("youtube.com") || host === "youtu.be") && /^\/shorts/i.test(path);
            const isEntertainment = [
                "tiktok.com",
                "facebook.com",
                "instagram.com",
                "reddit.com",
                "twitter.com",
                "x.com",
                "netflix.com",
            ].some((d) => host === d || host.endsWith(`.${d}`));

            if (isShorts) {
                isUrlBlocked = true;
                urlLabel = "YouTube Shorts (Entertainment)";
            } else if (isEntertainment && !isMarketingTask) {
                isUrlBlocked = true;
                urlLabel = "Consumer Social Media";
            } else if (isRoot && host !== "localhost") {
                urlLabel = "Missing Deep Link";
            } else {
                isUrlAcceptable = true;
                urlLabel = host;
            }
        } catch {
            urlLabel = "Invalid URL";
        }
    }

    const artifactPts = isUrlAcceptable ? 30 : 0;
    const reachabilityPts = primaryLink && !isUrlBlocked ? 20 : 0;
    let notesDepthPts = 5;
    if (notesLen >= 80 && hasSubstantiveTerms) {
        notesDepthPts = 30;
    } else if (notesLen >= 35) {
        notesDepthPts = 15;
    }

    const titleKeywords = (task?.title || "").toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const matchedCount = titleKeywords.filter((k) => proofNotes.toLowerCase().includes(k)).length;
    let alignmentPts = 5;
    if (matchedCount >= 2) alignmentPts = 20;
    else if (matchedCount === 1) alignmentPts = 10;

    const rawEstScore = artifactPts + reachabilityPts + notesDepthPts + alignmentPts;
    const estimatedScore = isUrlBlocked ? Math.min(38, rawEstScore) : Math.min(100, rawEstScore);
    const isReadyToPass = estimatedScore >= 80;

    const hasProofLinks = proofLinks.some((l) => l.url.trim().length > 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[680px] md:max-w-[740px] max-h-[90vh] sm:max-h-[85vh] p-0 flex flex-col bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl rounded-2xl overflow-hidden focus:outline-none">
                {/* Pinned Header */}
                <DialogHeader className="shrink-0 p-4 sm:p-6 pb-3 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur z-10 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/5 uppercase tracking-wider text-[10px]">
                                {activeTab === "audit" ? "System Quality Gate" : "Proof of Work Intercept"}
                            </Badge>
                        </div>

                        {auditReport && (
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-[10px] font-semibold px-2 py-0.5 border shrink-0",
                                    auditReport.gateStatus === "Passed"
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                )}
                            >
                                {auditReport.gateStatus === "Passed" ? "Audit Passed" : "Changes Requested"} ({auditReport.aiConfidenceScore}%)
                            </Badge>
                        )}
                    </div>

                    <div>
                        <DialogTitle className="text-lg sm:text-xl font-bold text-white tracking-tight break-words [overflow-wrap:anywhere]">
                            {mode === "transition"
                                ? "Submit Work Validation for Move"
                                : isViewOnly
                                ? "Task Proofs & Automated Audit"
                                : isEditing
                                ? "Edit Task Proofs"
                                : "Task Proofs & Quality Audit"}
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 text-xs sm:text-sm mt-1 break-words [overflow-wrap:anywhere]">
                            {mode === "transition" ? (
                                <>
                                    Moving <span className="font-semibold text-zinc-200">&quot;{task?.title}&quot;</span> to{" "}
                                    <Badge
                                        className={cn(
                                            "inline-flex items-center text-[10px] px-1.5 py-0.5",
                                            targetStatus === "Done"
                                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                                : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                        )}
                                    >
                                        {targetStatus}
                                    </Badge>{" "}
                                    requires deliverable verification.
                                </>
                            ) : (
                                <>
                                    Deliverables and automated quality audit for{" "}
                                    <span className="font-semibold text-zinc-200">&quot;{task?.title}&quot;</span>.
                                </>
                            )}
                        </DialogDescription>
                    </div>

                    {/* Segmented Tab Switcher */}
                    <div className="flex items-center gap-1.5 p-1 bg-zinc-900/80 border border-zinc-800/80 rounded-xl mt-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab("proofs")}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                                activeTab === "proofs"
                                    ? "bg-zinc-800 text-white shadow-sm border border-zinc-700/60"
                                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850"
                            )}
                        >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Deliverables & Proofs</span>
                            {hasProofLinks && (
                                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                                    {proofLinks.filter((l) => l.url.trim()).length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("audit")}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                                activeTab === "audit"
                                    ? "bg-zinc-800 text-white shadow-sm border border-zinc-700/60"
                                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850"
                            )}
                        >
                            <Cpu className="w-3.5 h-3.5" />
                            <span>AI Quality Audit</span>
                            {auditReport ? (
                                <span
                                    className={cn(
                                        "ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                                        auditReport.gateStatus === "Passed"
                                            ? "bg-emerald-500/20 text-emerald-300"
                                            : "bg-amber-500/20 text-amber-300"
                                    )}
                                >
                                    {auditReport.aiConfidenceScore}%
                                </span>
                            ) : (
                                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-500 font-mono">
                                    DoD
                                </span>
                            )}
                        </button>
                    </div>
                </DialogHeader>

                {/* Form wrapping scrollable body and pinned footer */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Scrollable Content Body */}
                    <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-4">
                        {error && (
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span className="break-words [overflow-wrap:anywhere]">{error}</span>
                            </div>
                        )}

                        {/* TAB 1: DELIVERABLES & PROOFS */}
                        {activeTab === "proofs" && (
                            <div className="space-y-4">
                                {mode === "transition" && (
                                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-indigo-300/90 leading-relaxed">
                                        <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                        <span>
                                            Submitting deliverables triggers the <strong>System Quality Gatekeeper</strong> to evaluate URL reachability, deliverables depth, and criteria alignment.
                                        </span>
                                    </div>
                                )}

                                {/* Proof Links Section */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                                            <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                                            Proof Links (Figma, GitHub PR, Vercel Preview)
                                        </Label>
                                        {!isViewOnly && isEditing && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={addLink}
                                                className="h-6 text-[10px] px-2 py-0 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                                            >
                                                + Add Link
                                            </Button>
                                        )}
                                        {!isViewOnly && !isEditing && mode === "edit" && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsEditing(true)}
                                                className="h-6 text-[10px] px-2 py-0 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 gap-1"
                                            >
                                                <Edit2 className="w-3 h-3" /> Edit Proofs
                                            </Button>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {proofLinks.map((link, index) => (
                                            <div key={index} className="flex gap-2 items-start">
                                                {isEditing ? (
                                                    <div className="flex-1 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                                                        <div className="w-full sm:w-[130px] shrink-0">
                                                            <Input
                                                                placeholder="Label (e.g. Figma)"
                                                                value={link.label}
                                                                onChange={(e) => updateLink(index, "label", e.target.value)}
                                                                className="bg-zinc-900/80 border-zinc-800 focus:border-indigo-500 text-zinc-100 placeholder:text-zinc-600 h-8 text-xs"
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <Input
                                                                type="text"
                                                                placeholder="https://..."
                                                                value={link.url}
                                                                onChange={(e) => updateLink(index, "url", e.target.value)}
                                                                className="bg-zinc-900/80 border-zinc-800 focus:border-indigo-500 text-zinc-100 placeholder:text-zinc-600 h-8 text-xs font-mono"
                                                            />
                                                        </div>
                                                        {proofLinks.length > 1 && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => removeLink(index)}
                                                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-8 px-2 text-xs shrink-0 self-end sm:self-auto"
                                                            >
                                                                Remove
                                                            </Button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 min-w-0 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/80 hover:bg-zinc-900 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                        {link.url ? (
                                                            <>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-semibold text-zinc-200">
                                                                            {link.label || "Proof Link"}
                                                                        </span>
                                                                        <span className="text-[10px] text-zinc-500 font-mono">
                                                                            #{index + 1}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 text-indigo-400 mt-0.5 min-w-0">
                                                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                                                        <a
                                                                            href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-xs font-mono underline hover:text-indigo-300 truncate break-all block max-w-full"
                                                                        >
                                                                            {link.url}
                                                                        </a>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleCopyUrl(link.url, index)}
                                                                        className="h-7 text-[11px] px-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 gap-1"
                                                                        title="Copy URL"
                                                                    >
                                                                        {copiedIndex === index ? (
                                                                            <>
                                                                                <Check className="w-3 h-3 text-emerald-400" />
                                                                                <span className="text-emerald-400">Copied</span>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Copy className="w-3 h-3" />
                                                                                <span>Copy</span>
                                                                            </>
                                                                        )}
                                                                    </Button>
                                                                    <a
                                                                        href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center justify-center h-7 px-2.5 rounded-md text-[11px] font-medium bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition-colors gap-1"
                                                                    >
                                                                        <span>Open</span>
                                                                        <ExternalLink className="w-3 h-3" />
                                                                    </a>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <span className="text-xs text-zinc-500 italic">Empty link</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Completion Notes Section */}
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                                        <Label htmlFor="proofNotes" className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5 text-indigo-400" />
                                            Completion Notes & Key Deliverables
                                        </Label>
                                        {isEditing && (
                                            <div className="flex items-center gap-1.5">
                                                {canUndoPolish && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={handleUndoPolish}
                                                        disabled={isPolishing}
                                                        className="h-6 text-[10px] px-2 py-0 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 gap-1 border border-amber-500/20"
                                                        title="Undo AI polish and restore raw notes"
                                                    >
                                                        <RotateCcw className="w-2.5 h-2.5" /> Undo
                                                    </Button>
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleInsertTemplate}
                                                    disabled={isPolishing}
                                                    className="h-6 text-[10px] px-2 py-0 border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:text-white hover:bg-zinc-800 gap-1"
                                                    title="Insert standard Definition of Done checklist"
                                                >
                                                    <ClipboardList className="w-2.5 h-2.5 text-zinc-400" />
                                                    <span>Template</span>
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleAiPolish}
                                                    disabled={isPolishing || proofNotes.trim().length < 3}
                                                    className="h-6 text-[10px] px-2 py-0 border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:text-white gap-1 shadow-sm transition-all"
                                                    title="Transform your raw notes into structured technical delivery notes"
                                                >
                                                    {isPolishing ? (
                                                        <>
                                                            <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-400" />
                                                            <span>Polishing...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                                                            <span>AI Polish</span>
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    {isEditing ? (
                                        <>
                                            <Textarea
                                                id="proofNotes"
                                                rows={3}
                                                placeholder="Detail what was completed, tested, or deployed... (or type brief bullets and click AI Polish)"
                                                value={proofNotes}
                                                onChange={(e) => setProofNotes(e.target.value)}
                                                className="bg-zinc-900/80 border-zinc-800 focus:border-indigo-500 text-zinc-100 placeholder:text-zinc-600 min-h-[90px] max-h-[180px] resize-y text-xs sm:text-sm break-words [overflow-wrap:anywhere]"
                                            />

                                            {/* Live Pre-Submission Quality Readiness Meter */}
                                            <div className="mt-2 p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-1.5 font-medium text-zinc-300">
                                                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                                        <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">Live Quality Readiness</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn("font-mono font-bold text-xs", isReadyToPass ? "text-emerald-400" : "text-amber-400")}>
                                                            ~{estimatedScore}%
                                                        </span>
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-[10px] py-0 px-1.5 border font-semibold",
                                                                isReadyToPass
                                                                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                                                    : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                                            )}
                                                        >
                                                            {isReadyToPass ? "Ready to Pass" : "Needs Detail"}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-1.5 text-[10px]">
                                                    <span
                                                        className={cn(
                                                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono border",
                                                            isUrlAcceptable
                                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                : isUrlBlocked
                                                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                                                : "bg-zinc-800/80 text-zinc-400 border-zinc-700/50"
                                                        )}
                                                    >
                                                        {isUrlAcceptable ? <Check className="w-2.5 h-2.5" /> : "○"} Artifact Link {primaryLink ? `(${urlLabel})` : ""}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono border",
                                                            notesLen >= 80
                                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                : notesLen >= 35
                                                                ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                                                : "bg-zinc-800/80 text-zinc-400 border-zinc-700/50"
                                                        )}
                                                    >
                                                        {notesLen >= 80 ? <Check className="w-2.5 h-2.5" /> : "○"} Notes ({notesLen}/80 chars)
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono border",
                                                            hasSubstantiveTerms
                                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                : "bg-zinc-800/80 text-zinc-400 border-zinc-700/50"
                                                        )}
                                                    >
                                                        {hasSubstantiveTerms ? <Check className="w-2.5 h-2.5" /> : "○"} Verification Terms
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono border",
                                                            matchedCount >= 1
                                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                : "bg-zinc-800/80 text-zinc-400 border-zinc-700/50"
                                                        )}
                                                    >
                                                        {matchedCount >= 1 ? <Check className="w-2.5 h-2.5" /> : "○"} Scope Aligned
                                                    </span>
                                                </div>

                                                {polishError && (
                                                    <p className="text-[11px] text-rose-400 leading-tight">
                                                        {polishError}
                                                    </p>
                                                )}

                                                {!isReadyToPass && !polishError && (
                                                    <p className="text-[11px] text-zinc-400 leading-snug flex items-center gap-1">
                                                        <span className="text-indigo-400 font-semibold">Tip:</span>
                                                        {notesLen < 35
                                                            ? 'Click "Template" or "AI Polish" to scaffold verification notes.'
                                                            : !hasSubstantiveTerms
                                                            ? 'Mention how you tested this (e.g. "tested on staging" or "unit tests passed").'
                                                            : isUrlBlocked
                                                            ? "Replace consumer media URL with an authentic PR, preview, or spec link."
                                                            : 'Click "AI Polish" to format into full DoD criteria.'}
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-zinc-800/80 text-zinc-300 text-xs sm:text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-h-[220px] overflow-y-auto leading-relaxed">
                                            {proofNotes || <span className="text-zinc-500 italic">No notes provided.</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 2: AI QUALITY AUDIT REPORT */}
                        {activeTab === "audit" && (
                            <div className="space-y-3">
                                {isLoadingAudit && (
                                    <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-400 gap-3">
                                        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                                        <span className="font-medium">Loading system quality gate report...</span>
                                    </div>
                                )}

                                {!isLoadingAudit && auditReport && (
                                    <div className="space-y-2">
                                        <AIAuditCard
                                            score={auditReport.aiConfidenceScore}
                                            status={auditReport.gateStatus}
                                            summary={auditReport.aiSummary}
                                            criteria={auditReport.criteriaBreakdown || []}
                                            submittedBy={auditReport.submittedBy}
                                            proofUrl={auditReport.proofUrl}
                                            createdAt={auditReport.createdAt}
                                        />
                                    </div>
                                )}

                                {!isLoadingAudit && !auditReport && (
                                    <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center space-y-3">
                                        <div className="p-3 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                            <Cpu className="w-6 h-6" />
                                        </div>
                                        <div className="space-y-1 max-w-sm">
                                            <h4 className="font-semibold text-sm text-zinc-200">
                                                No Automated Audit Report Yet
                                            </h4>
                                            <p className="text-xs text-zinc-400 leading-relaxed">
                                                An automated Definition of Done audit will evaluate deliverables when submitted to <strong>In Review</strong>.
                                            </p>
                                        </div>
                                        {!isViewOnly && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setActiveTab("proofs")}
                                                className="text-xs text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10 mt-1"
                                            >
                                                Submit Deliverables
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Pinned Footer */}
                    <DialogFooter className="shrink-0 p-4 sm:p-5 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur flex flex-row items-center justify-between sm:justify-between gap-3 z-10">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting || isPolishing}
                            className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 text-xs sm:text-sm"
                        >
                            {mode === "transition" ? "Cancel Drag" : "Close"}
                        </Button>

                        {!isViewOnly && isEditing ? (
                            <Button
                                type="submit"
                                disabled={isSubmitting || isPolishing}
                                className={cn(
                                    "text-white font-medium shadow-lg gap-2 text-xs sm:text-sm",
                                    targetStatus === "In Review"
                                        ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
                                        : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                                )}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>
                                            {targetStatus === "In Review"
                                                ? "AI Gatekeeper Scanning Deliverables..."
                                                : "Approving Task..."}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        {targetStatus === "In Review" ? (
                                            <>
                                                <Cpu className="w-4 h-4" />
                                                <span>Run Quality Gate & Submit</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShieldCheck className="w-4 h-4" />
                                                <span>{mode === "transition" ? "Approve & Mark Done" : "Save Changes"}</span>
                                            </>
                                        )}
                                    </>
                                )}
                            </Button>
                        ) : (
                            !isViewOnly && mode === "edit" && (
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setIsEditing(true);
                                        setActiveTab("proofs");
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium gap-1.5 text-xs sm:text-sm"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>Edit Deliverables</span>
                                </Button>
                            )
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

