"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, LayoutTemplate, Clock, Link as LinkIcon, CheckCircle2, ArrowRight, ShieldCheck } from "lucide-react";
import { FeedbackActionModal } from "@/features/client-portal/components/FeedbackActionModal";
import { ClientDocumentUpload } from "@/features/client-portal/components/ClientDocumentUpload";
import { HistoricalFeedbackCollapsible } from "@/features/client-portal/components/HistoricalFeedbackCollapsible";
import { CircularProgress } from "@/components/ui/circular-progress";
import Link from "next/link";

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
    createdAt: Date;
    milestones: Milestone[];
    tasks: Task[];
    lead?: { id: string } | null;
}

interface ClientPortalDashboardViewProps {
    projects: Project[];
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

export function ClientPortalDashboardView({ projects }: ClientPortalDashboardViewProps) {
    if (projects.length === 0) {
        return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
                <Card className="glass-card border-white/10 py-16 text-center max-w-2xl mx-auto shadow-2xl">
                    <CardContent className="space-y-4">
                        <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                            <LayoutTemplate className="h-8 w-8" />
                        </div>
                        <h3 className="text-2xl font-extrabold tracking-tight">No Active Client Projects</h3>
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

    return (
        <motion.div 
            variants={containerVariants} 
            initial="hidden" 
            animate="visible" 
            className="space-y-12"
        >
            {projects.map((project) => {
                const totalTasks = project.tasks.length;
                const completedTasks = project.tasks.filter(t => t.status === "Done").length;
                const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                return (
                    <motion.div key={project.id} variants={itemVariants} className="space-y-6">
                        {/* Project Header Card */}
                        <Card className="glass-card border-white/10 relative overflow-hidden shadow-2xl backdrop-blur-xl bg-gradient-to-b from-white/5 to-transparent">
                            <CardHeader className="pb-4">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                    <div className="space-y-1.5 flex-1">
                                        <div className="flex items-center gap-3">
                                            <CardTitle className="text-3xl font-extrabold tracking-tight">{project.title}</CardTitle>
                                            <Badge 
                                                variant={project.status === "Completed" ? "default" : "outline"} 
                                                className={`text-xs px-3 py-1 font-semibold ${
                                                    project.status === 'Completed' ? 'bg-green-500 text-black hover:bg-green-600' : 
                                                    project.status === 'In Progress' ? 'border-primary text-primary bg-primary/10' : 'border-white/20'
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
                                    <div className="flex items-center gap-4 bg-black/40 border border-white/10 p-3.5 rounded-2xl shrink-0 shadow-inner">
                                        <CircularProgress value={progressPercent} size={90} strokeWidth={8} />
                                        <div className="flex flex-col text-left">
                                            <span className="text-xs font-semibold text-muted-foreground">Overall Completion</span>
                                            <span className="text-lg font-bold text-white">{completedTasks} / {totalTasks} Tasks</span>
                                            <span className="text-[11px] text-primary/80 font-medium flex items-center gap-1 mt-0.5">
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
                                <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-2 text-white">
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
                                                className={`p-5 rounded-2xl border transition-all shadow-lg ${
                                                    isCompleted ? "bg-white/5 border-green-500/30 text-white" :
                                                    isInProgress ? "bg-primary/10 border-primary/50 text-white" :
                                                    isApprovalRequired ? "bg-yellow-500/10 border-yellow-500/50 text-white ring-1 ring-yellow-500/30" :
                                                    "bg-black/50 border-white/5 text-muted-foreground"
                                                }`}
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="flex items-start gap-4">
                                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 shadow-md ${
                                                            isCompleted ? "bg-green-500 text-black" :
                                                            isInProgress ? "bg-primary text-black" :
                                                            isApprovalRequired ? "bg-yellow-500 text-black animate-pulse" :
                                                            "bg-white/10 text-white/70"
                                                        }`}>
                                                            {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : milestone.order}
                                                        </div>

                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-base text-white">{milestone.title}</h4>
                                                                <Badge variant="outline" className={`text-[10px] font-bold ${
                                                                    isCompleted ? "border-green-500/40 text-green-400" :
                                                                    isInProgress ? "border-primary/40 text-primary" :
                                                                    isApprovalRequired ? "border-yellow-500/40 text-yellow-400 animate-pulse" :
                                                                    "border-white/10 text-muted-foreground"
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
                                <Card className="glass-card border-white/10 shadow-xl backdrop-blur-md">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
                                            <FileText className="h-4 w-4 text-primary" /> Document Hub
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                        <p className="text-muted-foreground text-xs leading-relaxed">
                                            Upload technical specifications, brand assets, or review project files shared by our team.
                                        </p>

                                        {project.lead?.id ? (
                                            <ClientDocumentUpload leadId={project.lead.id} />
                                        ) : (
                                            <div className="p-3 rounded-lg border border-white/5 bg-black/40 text-xs text-muted-foreground text-center">
                                                Document workspace being configured.
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="glass-card border-white/10 shadow-xl backdrop-blur-md">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
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
                                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-white/10 transition-all border border-white/5 bg-black/30 group"
                                                >
                                                    <span className="truncate max-w-[80%] font-medium text-xs text-white group-hover:text-primary transition-colors">
                                                        {url}
                                                    </span>
                                                    <LinkIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                                </a>
                                            ))
                                        ) : (
                                            <p className="text-muted-foreground text-xs italic p-2 bg-black/30 rounded-lg border border-white/5 text-center">
                                                Staging preview links will appear here when active builds are deployed.
                                            </p>
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
