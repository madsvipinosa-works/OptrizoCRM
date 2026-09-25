"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    FileText, 
    LayoutTemplate, 
    Clock, 
    Link as LinkIcon, 
    CheckCircle2, 
    ArrowRight, 
    ShieldCheck, 
    ExternalLink, 
    Briefcase,
    Trash2,
    Bell,
    Paperclip,
    Sparkles
} from "lucide-react";
import { FeedbackActionModal } from "@/features/client-portal/components/FeedbackActionModal";
import { ClientDocumentUpload } from "@/features/client-portal/components/ClientDocumentUpload";
import { HistoricalFeedbackCollapsible } from "@/features/client-portal/components/HistoricalFeedbackCollapsible";
import { CircularProgress } from "@/components/ui/circular-progress";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteProjectDocument } from "@/features/pm/actions";
import { markNotificationAsRead } from "@/features/notifications/actions";
import { toast } from "sonner";
import { useTransition } from "react";
import { type ProjectDocumentItem } from "@/db/schema";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface MilestoneFeedback {
    id: string;
    status: string;
    commentText: string | null;
    createdAt: Date;
}

interface Milestone {
    id: string;
    title: string;
    status: string;
    order: number;
    feedback?: MilestoneFeedback[];
}

interface Task {
    id: string;
    milestoneId: string;
    title: string;
    description: string | null;
    status: string;
    proofLinks?: { label: string; url: string }[] | null;
    proofNotes?: string | null;
}

interface Project {
    id: string;
    title: string;
    description: string | null;
    status: string;
    stagingUrls?: string[] | null;
    documents?: ProjectDocumentItem[] | null;
    createdAt: Date;
    milestones: Milestone[];
    tasks: Task[];
    lead?: { id: string } | null;
}

export interface ClientNotificationItem {
    id: string;
    message: string;
    type: string | null;
    link: string | null;
    read: boolean;
    createdAt: Date;
}

interface ClientPortalDashboardViewProps {
    projects: Project[];
    pendingProposals?: any[];
    recentNotifications?: ClientNotificationItem[];
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export function ClientPortalDashboardView({ 
    projects, 
    pendingProposals = [], 
    recentNotifications = [] 
}: ClientPortalDashboardViewProps) {
    const router = useRouter();
    if (projects.length === 0) {
        if (pendingProposals.length > 0) {
            return (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6 max-w-3xl mx-auto">
                    <div className="p-6 sm:p-8 rounded-2xl glass-card border border-primary/30 shadow-2xl space-y-6 text-left">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                                        Statement of Work Ready
                                    </span>
                                </div>
                                <h2 className="text-2xl font-bold tracking-tight text-foreground font-serif">
                                    Your Project Proposal is Ready
                                </h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Our team has prepared your Statement of Work and technical architecture scope. Please review the deliverables, milestone schedule, and digitally sign your agreement to commence project kickoff.
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                                <FileText className="h-6 w-6" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            {pendingProposals.map((prop) => (
                                <div key={prop.id} className="p-4 rounded-xl border border-border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/40 transition-all">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm text-foreground font-mono">
                                                {prop.proposalCode || "Statement of Work"}
                                            </span>
                                            <Badge className="bg-primary text-black font-bold text-[10px]">
                                                {prop.status === "Approved" ? "Executed Contract" : "Awaiting Signature"}
                                            </Badge>
                                        </div>
                                        {prop.scope && (
                                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-md">
                                                {prop.scope}
                                            </p>
                                        )}
                                        <div className="text-xs font-mono text-emerald-400 font-semibold">
                                            Total Investment: ${(Number(prop.total) || 0).toLocaleString()}
                                        </div>
                                    </div>
                                    <Link
                                        href={`/proposal/${prop.id}`}
                                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black font-bold text-xs hover:bg-primary/90 transition-all shadow-md shrink-0"
                                    >
                                        <span>Review &amp; Sign Agreement</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>

                    {recentNotifications && recentNotifications.length > 0 && (
                        <div className="p-5 rounded-2xl glass-card border border-border shadow-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Bell className="h-3.5 w-3.5 text-primary" /> Recent Activity & Updates
                                </h4>
                                {recentNotifications.filter(n => !n.read).length > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
                                        {recentNotifications.filter(n => !n.read).length} new
                                    </span>
                                )}
                            </div>
                            <div className="space-y-2 max-h-56 overflow-y-auto">
                                {recentNotifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        onClick={async () => {
                                            if (!notif.read) await markNotificationAsRead(notif.id);
                                            if (notif.link) router.push(notif.link);
                                        }}
                                        className={cn(
                                            "p-2.5 rounded-xl border transition-all cursor-pointer group flex items-start gap-2.5 text-left",
                                            notif.read ? "border-border/40 bg-card/40 opacity-75 hover:opacity-100" : "border-primary/30 bg-primary/5 hover:bg-primary/10 shadow-xs"
                                        )}
                                    >
                                        <div className="p-1.5 rounded-lg shrink-0 mt-0.5 bg-primary/10 text-primary">
                                            {notif.type === "proposal" ? <FileText className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                                                {notif.message}
                                            </p>
                                            <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">
                                                {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>
            );
        }

        return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
                <Card className="glass-card border-border py-16 text-center max-w-2xl mx-auto shadow-2xl">
                    <CardContent className="space-y-4">
                        <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                            <LayoutTemplate className="h-8 w-8" />
                        </div>
                        <h3 className="text-2xl font-extrabold tracking-tight text-foreground">No Active Client Projects</h3>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                            Your dedicated project portal space is currently being initialized by our engineering team.
                        </p>
                        <div className="pt-4">
                            <Link href="/portal/request-proposal" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                                <span>Request New Proposal</span>
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        );
    }

    const [isPending, startTransition] = useTransition();

    const handleDeleteDoc = (projectId: string, docId: string) => {
        if (!confirm("Are you sure you want to delete this document?")) return;
        startTransition(async () => {
            const res = await deleteProjectDocument(projectId, docId);
            if (res.success) {
                toast.success("Document deleted");
            } else {
                toast.error(res.message);
            }
        });
    };

    return (
        <motion.div 
            variants={containerVariants} 
            initial="hidden" 
            animate="visible" 
            className="space-y-12"
        >
            {/* Action Alert Banner if there are pending proposals alongside active projects */}
            {pendingProposals.length > 0 && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-primary/15 via-card to-card border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/20 text-primary shrink-0">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-foreground">
                                Action Required: New Proposal Ready for Digital Signature
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Review your latest Statement of Work ({pendingProposals[0].proposalCode || "Proposal"}) to execute agreement.
                            </p>
                        </div>
                    </div>
                    <Link
                        href={`/proposal/${pendingProposals[0].id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-black text-xs font-bold shrink-0 shadow-xs"
                    >
                        <span>Review &amp; Sign</span> &rarr;
                    </Link>
                </div>
            )}

            {projects.map((project) => {
                const totalTasks = project.tasks.length;
                const completedTasks = project.tasks.filter(t => t.status === "Done").length;
                const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                return (
                    <motion.div key={project.id} variants={itemVariants} className="space-y-6">
                        {/* Project Header Card */}
                        <Card className="glass-card border-border relative overflow-hidden shadow-2xl backdrop-blur-xl">
                            <CardHeader className="pb-4">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                    <div className="space-y-1.5 flex-1">
                                        <div className="flex items-center gap-3">
                                            <CardTitle className="text-3xl font-extrabold tracking-tight text-foreground">{project.title}</CardTitle>
                                            <Badge 
                                                variant={project.status === "Completed" ? "default" : "outline"} 
                                                className={`text-xs px-3 py-1 font-semibold ${
                                                    project.status === 'Completed' ? 'bg-primary text-black hover:bg-primary/90' : 
                                                    project.status === 'In Progress' ? 'border-primary text-primary bg-primary/10' : 'border-border'
                                                }`}
                                            >
                                                {project.status}
                                            </Badge>
                                        </div>
                                        <CardDescription className="text-muted-foreground text-sm leading-relaxed max-w-3xl">
                                            {project.description || "Active software development project delivery portal."}
                                        </CardDescription>
                                    </div>

                                    {/* Circular Progress Indicator */}
                                    <div className="flex items-center gap-4 bg-card border border-border p-3.5 rounded-2xl shrink-0 shadow-sm">
                                        <CircularProgress value={progressPercent} size={90} strokeWidth={8} />
                                        <div className="flex flex-col text-left">
                                            <span className="text-xs font-semibold text-muted-foreground font-mono uppercase">Overall Completion</span>
                                            <span className="text-lg font-bold text-foreground font-mono">{completedTasks} / {totalTasks} Tasks</span>
                                            <span className="text-[11px] text-primary font-medium flex items-center gap-1 mt-0.5">
                                                <ShieldCheck className="h-3.5 w-3.5" /> Client Verified
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                        </Card>

                        {/* Main Grid: Milestones & Document Hub */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Col: Milestones Roadmap */}
                            <div className="lg:col-span-2 space-y-4">
                                <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-2 text-foreground">
                                    <Clock className="h-5 w-5 text-primary" /> Project Roadmap & Milestones
                                </h3>

                                <div className="space-y-4">
                                    {project.milestones.map((milestone) => {
                                        const isApprovalRequired = milestone.status === "Client Approval";
                                        const isCompleted = milestone.status === "Completed";
                                        const isInProgress = milestone.status === "In Progress";
                                        const milestoneTasks = project.tasks.filter(t => t.milestoneId === milestone.id);

                                        return (
                                            <motion.div 
                                                key={milestone.id}
                                                whileHover={{ scale: 1.005 }}
                                                transition={{ duration: 0.2 }}
                                                className={`p-5 rounded-2xl border transition-all shadow-sm ${
                                                    isCompleted ? "bg-muted/40 border-primary/30 text-foreground" :
                                                    isInProgress ? "bg-primary/5 border-primary/40 text-foreground" :
                                                    isApprovalRequired ? "bg-amber-500/10 border-amber-500/40 text-foreground ring-1 ring-amber-500/30" :
                                                    "bg-card border-border text-muted-foreground"
                                                }`}
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="flex items-start gap-4">
                                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm font-mono ${
                                                            isCompleted ? "bg-primary text-black" :
                                                            isInProgress ? "bg-primary text-black" :
                                                            isApprovalRequired ? "bg-amber-500 text-black animate-pulse" :
                                                            "bg-muted text-muted-foreground"
                                                        }`}>
                                                            {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : milestone.order}
                                                        </div>

                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-base text-foreground">{milestone.title}</h4>
                                                                <Badge variant="outline" className={`text-[10px] font-bold font-mono ${
                                                                    isCompleted ? "border-primary/40 text-primary bg-primary/10" :
                                                                    isInProgress ? "border-primary/40 text-primary bg-primary/10" :
                                                                    isApprovalRequired ? "border-amber-500/40 text-amber-500 animate-pulse bg-amber-500/10" :
                                                                    "border-border text-muted-foreground"
                                                                }`}>
                                                                    {milestone.status}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                {milestoneTasks.length} deliverable{milestoneTasks.length !== 1 ? 's' : ''} tied to this milestone
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Approval Modal Action Button */}
                                                    {isApprovalRequired && (
                                                        <div className="shrink-0 flex items-center gap-2">
                                                            <FeedbackActionModal 
                                                                milestoneId={milestone.id} 
                                                                milestoneTitle={milestone.title} 
                                                                tasks={milestoneTasks}
                                                                projectId={project.id}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Historical Feedback Section in Collapsible */}
                                                {milestone.feedback && milestone.feedback.length > 0 && (
                                                    <HistoricalFeedbackCollapsible feedback={milestone.feedback} />
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right Col: Staging Links & Document Hub */}
                            <div className="space-y-6">
                                <Card className="glass-card border-border shadow-xl backdrop-blur-md">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                                            <FileText className="h-4 w-4 text-primary" /> Document Hub
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-sm">
                                        <p className="text-muted-foreground text-xs leading-relaxed">
                                            Upload technical specifications, brand assets, or review project deliverables shared by our team.
                                        </p>

                                        {/* Section A: Agency Deliverables */}
                                        {project.documents && project.documents.filter(d => d.uploadedByRole !== "client").length > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                        <Briefcase className="h-3.5 w-3.5 text-amber-500" /> Agency Deliverables ({project.documents.filter(d => d.uploadedByRole !== "client").length})
                                                    </span>
                                                </div>
                                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                    {project.documents.filter(d => d.uploadedByRole !== "client").map((doc) => (
                                                        <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card/60 hover:bg-muted/40 hover:border-primary/40 transition-all group">
                                                            <a
                                                                href={doc.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-3 flex-1 min-w-0"
                                                            >
                                                                <FileText className="h-4 w-4 text-primary shrink-0" />
                                                                <div className="flex flex-col min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                                                                            {doc.title}
                                                                        </span>
                                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded font-mono border-amber-500/30 text-amber-500 bg-amber-500/10">
                                                                            AGENCY
                                                                        </Badge>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                                                        {doc.sizeBytes !== undefined && doc.sizeBytes > 0 && (
                                                                            <span>{(doc.sizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                                                                        )}
                                                                        {doc.createdAt && (
                                                                            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 ml-auto" />
                                                            </a>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Section B: Client Uploads */}
                                        <div className="pt-2 border-t border-border space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                    <FileText className="h-3.5 w-3.5 text-sky-400" /> Your Uploaded Files ({project.documents ? project.documents.filter(d => d.uploadedByRole === "client").length : 0})
                                                </span>
                                            </div>

                                            <ClientDocumentUpload leadId={project.lead?.id} projectId={project.id} />

                                            {project.documents && project.documents.filter(d => d.uploadedByRole === "client").length > 0 && (
                                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 pt-1">
                                                    {project.documents.filter(d => d.uploadedByRole === "client").map((doc) => (
                                                        <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-lg border border-sky-500/25 bg-sky-500/5 hover:border-sky-500/40 transition-all group">
                                                            <a
                                                                href={doc.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-3 flex-1 min-w-0"
                                                            >
                                                                <FileText className="h-4 w-4 text-sky-400 shrink-0" />
                                                                <div className="flex flex-col min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-medium text-foreground truncate group-hover:text-sky-400 transition-colors">
                                                                            {doc.title}
                                                                        </span>
                                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded font-mono border-sky-500/30 text-sky-400 bg-sky-500/10">
                                                                            CLIENT
                                                                        </Badge>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                                                        {doc.sizeBytes !== undefined && doc.sizeBytes > 0 && (
                                                                            <span>{(doc.sizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                                                                        )}
                                                                        {doc.createdAt && (
                                                                            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-sky-400 shrink-0 ml-auto" />
                                                            </a>
                                                            <button
                                                                type="button"
                                                                disabled={isPending}
                                                                onClick={() => handleDeleteDoc(project.id, doc.id)}
                                                                className="p-1.5 ml-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                                title="Delete document"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="glass-card border-border shadow-xl backdrop-blur-md">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                                            <LinkIcon className="h-4 w-4 text-primary" /> Staging & Environment Previews
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2.5 text-sm">
                                        {project.stagingUrls && project.stagingUrls.length > 0 ? (
                                            project.stagingUrls.map((url, idx) => (
                                                <a 
                                                    key={idx} 
                                                    href={url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/40 transition-all border border-border bg-card group"
                                                >
                                                    <span className="truncate max-w-[80%] font-medium text-xs text-foreground group-hover:text-primary transition-colors font-mono">
                                                        {url}
                                                    </span>
                                                    <LinkIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                                </a>
                                            ))
                                        ) : (
                                            <p className="text-muted-foreground text-xs italic p-2 bg-card rounded-lg border border-border text-center">
                                                Staging preview links will appear here when active builds are deployed.
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Recent Activity & Updates Card */}
                                <Card className="glass-card border-border shadow-xl backdrop-blur-md">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                                                <Bell className="h-4 w-4 text-primary" /> Recent Activity & Updates
                                            </CardTitle>
                                            {recentNotifications && recentNotifications.filter(n => !n.read).length > 0 && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
                                                    {recentNotifications.filter(n => !n.read).length} new
                                                </span>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-2.5">
                                        {recentNotifications && recentNotifications.length > 0 ? (
                                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                                {recentNotifications.map((notif) => (
                                                    <div 
                                                        key={notif.id}
                                                        onClick={async () => {
                                                            if (!notif.read) {
                                                                await markNotificationAsRead(notif.id);
                                                            }
                                                            if (notif.link) {
                                                                router.push(notif.link);
                                                            }
                                                        }}
                                                        className={cn(
                                                            "p-2.5 rounded-xl border transition-all cursor-pointer group flex items-start gap-2.5 text-left",
                                                            notif.read 
                                                                ? "border-border/40 bg-card/40 opacity-75 hover:opacity-100 hover:border-border" 
                                                                : "border-primary/30 bg-primary/5 hover:bg-primary/10 shadow-xs"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "p-1.5 rounded-lg shrink-0 mt-0.5 text-xs",
                                                            notif.type === "proposal" ? "bg-purple-500/15 text-purple-400" :
                                                            notif.type === "milestone" ? "bg-emerald-500/15 text-emerald-400" :
                                                            notif.type === "document" ? "bg-blue-500/15 text-blue-400" :
                                                            notif.type === "project" ? "bg-amber-500/15 text-amber-400" :
                                                            "bg-primary/15 text-primary"
                                                        )}>
                                                            {notif.type === "proposal" ? <FileText className="h-3.5 w-3.5" /> :
                                                             notif.type === "milestone" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                                                             notif.type === "document" ? <Paperclip className="h-3.5 w-3.5" /> :
                                                             notif.type === "project" ? <Briefcase className="h-3.5 w-3.5" /> :
                                                             <Bell className="h-3.5 w-3.5" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                                                {notif.message}
                                                            </p>
                                                            <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                                                                <span>{formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}</span>
                                                                {notif.link && (
                                                                    <span className="text-primary font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        View &rarr;
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 rounded-xl border border-border bg-card/30 text-center space-y-1">
                                                <Sparkles className="h-4 w-4 text-muted-foreground mx-auto opacity-70" />
                                                <p className="text-xs text-muted-foreground">All caught up! No recent project activity.</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </motion.div>
                );
            })}
        </motion.div>
    );
}
