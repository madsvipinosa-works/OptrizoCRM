import { db } from "@/db";
import { leads, tasks, milestones, agencyProjects } from "@/db/schema";
import { eq, and, isNull, lt, ne, or, desc, gte, lte } from "drizzle-orm";
import { auth, hasRole } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, CheckCircle, ArrowRight, Activity, Plus, FileText, LayoutTemplate, Briefcase, Calendar } from "lucide-react";
import { format, isToday, isTomorrow, startOfDay, endOfDay, addDays } from "date-fns";
import { cn } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user) {
        redirect("/auth/login");
    }

    const currentUserId = session.user.id;
    const userName = session.user.name?.split(" ")[0] || "Team";
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const tomorrowEnd = endOfDay(addDays(now, 1));

    // Role checks
    const isSales = hasRole(session, ["superadmin", "sales"]);
    const isDelivery = hasRole(session, ["superadmin", "manager", "developer"]);
    const canSeeAllLeads = hasRole(session, ["superadmin"]);

    // ==========================================
    // 1. FETCH SALES & CRM DATA
    // ==========================================
    let activeLeads: any[] = [];
    let overdueLeads: any[] = [];
    let unassignedLeads: any[] = [];
    let todayFollowUps: any[] = [];
    
    if (isSales) {
        const allActiveLeads = await db.query.leads.findMany({
            where: and(
                ne(leads.status, "Closed Won"),
                ne(leads.status, "Closed Lost"),
                eq(leads.isArchived, false)
            ),
            with: { assignees: { with: { user: true } } },
        });

        // Filter based on visibility
        const myLeads = allActiveLeads.filter(lead => 
            canSeeAllLeads || lead.assignees.length === 0 || lead.assignees.some(a => a.userId === currentUserId)
        );

        activeLeads = myLeads;
        unassignedLeads = myLeads.filter(l => l.assignees.length === 0);
        overdueLeads = myLeads.filter(l => l.nextFollowUpDate && l.nextFollowUpDate < todayStart);
        todayFollowUps = myLeads.filter(l => l.nextFollowUpDate && l.nextFollowUpDate >= todayStart && l.nextFollowUpDate <= todayEnd);
    }

    // ==========================================
    // 2. FETCH DELIVERY & PM DATA
    // ==========================================
    let openProjects: any[] = [];
    let blockedTasks: any[] = [];
    let overdueTasks: any[] = [];
    let todayTasks: any[] = [];
    let pendingApprovals: any[] = [];

    if (isDelivery) {
        openProjects = await db.query.agencyProjects.findMany({
            where: and(ne(agencyProjects.status, "Completed"), eq(agencyProjects.isArchived, false))
        });

        const activeTasks = await db.query.tasks.findMany({
            where: and(
                isNull(tasks.deletedAt),
                ne(tasks.status, "Done")
            ),
            with: { project: true, assignees: true },
        });

        const myActiveTasks = activeTasks.filter(t => !t.project?.isArchived && (hasRole(session, ["superadmin", "manager"]) || t.assignees.some(a => a.userId === currentUserId)));

        blockedTasks = myActiveTasks.filter(t => t.status === "Blocked");
        overdueTasks = myActiveTasks.filter(t => t.dueDate && t.dueDate < todayStart && t.status !== "Blocked");
        todayTasks = myActiveTasks.filter(t => t.dueDate && t.dueDate >= todayStart && t.dueDate <= tomorrowEnd);

        pendingApprovals = (await db.query.milestones.findMany({
            where: and(eq(milestones.status, "Client Approval"), isNull(milestones.deletedAt)),
            with: { project: true }
        })).filter(m => !m.project?.isArchived);
    }

    // ==========================================
    // 3. RECENT ACTIVITY (Aggregated)
    // ==========================================
    // Simulating an activity feed by grabbing recently updated entities
    const recentUpdates: any[] = [];
    if (isSales && activeLeads.length > 0) {
        const sortedLeads = [...activeLeads].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3);
        sortedLeads.forEach(l => recentUpdates.push({ type: 'lead', title: `Lead updated: ${l.businessName || l.contactName}`, date: l.updatedAt, url: `/dashboard/leads?leadId=${l.id}` }));
    }
    if (isDelivery) {
        const recentTasks = await db.query.tasks.findMany({
            where: isNull(tasks.deletedAt),
            orderBy: [desc(tasks.updatedAt)],
            limit: 3,
            with: { project: true }
        });
        recentTasks.forEach(t => recentUpdates.push({ type: 'task', title: `Task moved to ${t.status}: ${t.title}`, date: t.updatedAt, url: `/dashboard/pm/${t.projectId}` }));
    }
    recentUpdates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="space-y-8 animate-in fade-in duration-700 w-full max-w-[1600px] mx-auto pb-12">
            
            {/* HEADER & QUICK ACTIONS */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-6">
                <div>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">Good morning, {userName}</h2>
                    <p className="text-muted-foreground font-medium mt-1">{format(now, "EEEE, MMMM do, yyyy")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {isSales && (
                        <>
                            <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-colors shadow-sm">
                                <Plus className="w-4 h-4 mr-2" /> New Lead
                            </Button>
                            <Button variant="outline" className="border-border text-foreground hover:bg-muted transition-colors shadow-sm">
                                <FileText className="w-4 h-4 mr-2" /> Draft Proposal
                            </Button>
                        </>
                    )}
                    {isDelivery && (
                        <Button variant="outline" className="border-border text-foreground hover:bg-muted transition-colors shadow-sm">
                            <LayoutTemplate className="w-4 h-4 mr-2" /> Open Project Brief
                        </Button>
                    )}
                </div>
            </div>

            {/* KPI METRICS ROW */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {isSales && (
                    <>
                        <Card className="glass-card border-border/60 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Briefcase className="w-12 h-12 text-primary" />
                            </div>
                            <CardContent className="p-5">
                                <p className="text-sm font-medium text-muted-foreground">Active Leads</p>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <h3 className="text-3xl font-black">{activeLeads.length}</h3>
                                    {unassignedLeads.length > 0 && (
                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">
                                            {unassignedLeads.length} unassigned
                                        </Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="glass-card border-border/60 shadow-sm relative overflow-hidden group">
                            <CardContent className="p-5">
                                <p className="text-sm font-medium text-muted-foreground">Overdue Follow-ups</p>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <h3 className={cn("text-3xl font-black", overdueLeads.length > 0 ? "text-destructive" : "text-foreground")}>
                                        {overdueLeads.length}
                                    </h3>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}

                {isDelivery && (
                    <>
                        <Card className="glass-card border-border/60 shadow-sm relative overflow-hidden group">
                            <CardContent className="p-5">
                                <p className="text-sm font-medium text-muted-foreground">Open Projects</p>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <h3 className="text-3xl font-black">{openProjects.length}</h3>
                                    {pendingApprovals.length > 0 && (
                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                                            {pendingApprovals.length} pending
                                        </Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="glass-card border-border/60 shadow-sm relative overflow-hidden group">
                            <CardContent className="p-5">
                                <p className="text-sm font-medium text-muted-foreground">Blocked Tasks</p>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <h3 className={cn("text-3xl font-black", blockedTasks.length > 0 ? "text-destructive" : "text-foreground")}>
                                        {blockedTasks.length}
                                    </h3>
                                    {blockedTasks.length > 0 && <span className="text-xs text-destructive/80 font-medium">Require attention</span>}
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* TWO COLUMN WORKSPACE */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT COLUMN: PRIORITIES & EXCEPTIONS */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* TODAY'S PRIORITIES */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                            <Calendar className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-bold">Today's Priorities</h3>
                            <Badge variant="secondary" className="ml-auto">{todayFollowUps.length + todayTasks.length}</Badge>
                        </div>
                        
                        <div className="grid gap-3">
                            {todayFollowUps.length === 0 && todayTasks.length === 0 && (
                                <div className="p-8 text-center border border-dashed border-border/60 rounded-xl bg-muted/10">
                                    <p className="text-sm text-muted-foreground">No tasks or follow-ups scheduled for today.</p>
                                </div>
                            )}

                            {isSales && todayFollowUps.map(lead => (
                                <Link key={lead.id} href={`/dashboard/leads?leadId=${lead.id}`} className="block group">
                                    <div className="p-3.5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 transition-colors flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">LEAD</Badge>
                                                <p className="font-semibold text-sm group-hover:text-primary transition-colors">{lead.businessName || lead.contactName}</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">Follow up scheduled for today</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </Link>
                            ))}

                            {isDelivery && todayTasks.map(task => (
                                <Link key={task.id} href={`/dashboard/pm/${task.projectId}`} className="block group">
                                    <div className="p-3.5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 transition-colors flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">TASK</Badge>
                                                <p className="font-semibold text-sm group-hover:text-primary transition-colors">{task.title}</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">Due {isToday(task.dueDate!) ? 'Today' : 'Tomorrow'} • {task.project?.title}</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* REQUIRES ATTENTION (EXCEPTIONS) */}
                    {(overdueLeads.length > 0 || blockedTasks.length > 0 || overdueTasks.length > 0) && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-destructive/20 pb-2">
                                <AlertCircle className="w-5 h-5 text-destructive" />
                                <h3 className="text-lg font-bold text-destructive">Requires Attention</h3>
                                <Badge variant="destructive" className="ml-auto bg-destructive/10 text-destructive hover:bg-destructive/20 border-0">
                                    {overdueLeads.length + blockedTasks.length + overdueTasks.length} Issues
                                </Badge>
                            </div>
                            
                            <div className="grid gap-3">
                                {isSales && overdueLeads.map(lead => (
                                    <Link key={lead.id} href={`/dashboard/leads?leadId=${lead.id}`} className="block group">
                                        <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-sm text-foreground">{lead.businessName || lead.contactName}</p>
                                                <p className="text-xs text-destructive font-medium mt-1">Overdue Follow-up</p>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-destructive/60 group-hover:text-destructive transition-colors" />
                                        </div>
                                    </Link>
                                ))}

                                {isDelivery && blockedTasks.map(task => (
                                    <Link key={task.id} href={`/dashboard/pm/${task.projectId}`} className="block group">
                                        <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-sm text-foreground">{task.title}</p>
                                                <p className="text-xs text-destructive font-medium mt-1">Blocked Task • {task.project?.title}</p>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-destructive/60 group-hover:text-destructive transition-colors" />
                                        </div>
                                    </Link>
                                ))}
                                
                                {isDelivery && overdueTasks.map(task => (
                                    <Link key={task.id} href={`/dashboard/pm/${task.projectId}`} className="block group">
                                        <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-sm text-foreground">{task.title}</p>
                                                <p className="text-xs text-destructive font-medium mt-1">Overdue Task • {task.project?.title}</p>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-destructive/60 group-hover:text-destructive transition-colors" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: RECENT ACTIVITY */}
                <div className="lg:col-span-1">
                    <Card className="glass-card border-border/60 shadow-sm h-full">
                        <CardHeader className="pb-4 border-b border-border/50">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Activity className="w-4 h-4 text-primary" /> Recent Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative">
                            {recentUpdates.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No recent activity detected.</p>
                            ) : (
                                <div className="space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/60 before:to-transparent">
                                    {recentUpdates.map((update, idx) => (
                                        <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                            <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-background bg-muted-foreground/20 text-muted-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                                            </div>
                                            <Link href={update.url} className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg border border-border/50 bg-muted/10 hover:bg-muted/30 transition-colors">
                                                <div className="flex items-center justify-between mb-1">
                                                    <Badge variant="outline" className="text-[9px] uppercase font-mono bg-background/50">{update.type}</Badge>
                                                    <time className="text-[10px] text-muted-foreground font-mono">{format(new Date(update.date), "MMM d, h:mm a")}</time>
                                                </div>
                                                <div className="text-xs text-foreground font-medium line-clamp-2">{update.title}</div>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
                
            </div>
        </div>
    );
}
