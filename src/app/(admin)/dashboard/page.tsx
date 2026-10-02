import { db } from "@/db";
import { leads, tasks, milestones } from "@/db/schema";
import { eq, and, isNull, lt, ne, or } from "drizzle-orm";
import { auth, hasRole } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, UserX, CheckCircle, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user) {
        redirect("/auth/login");
    }

    const currentUserId = session.user.id;

    // Role checks to determine what data to fetch
    const isSales = hasRole(session, ["superadmin", "sales"]);
    const canSeeAllLeads = hasRole(session, ["superadmin"]);
    const isDelivery = hasRole(session, ["superadmin", "manager", "developer"]);

    const now = new Date();

    // 1. Overdue Follow-ups (Sales)
    const overdueLeads = isSales
        ? (await db.query.leads.findMany({
            where: and(
                lt(leads.nextFollowUpDate, now),
                ne(leads.status, "Closed Won"),
                ne(leads.status, "Closed Lost"),
                eq(leads.isArchived, false)
            ),
            with: {
                assignees: { with: { user: true } }
            },
            orderBy: (l, { asc }) => [asc(l.nextFollowUpDate)],
        })).filter((lead) =>
            canSeeAllLeads || lead.assignees.length === 0 || lead.assignees.some((assignee) => assignee.userId === currentUserId)
        )
        : [];

    // 2. Unassigned Leads (Sales/Manager)
    const unassignedLeads = isSales
        ? (await db.query.leads.findMany({
            where: and(
                ne(leads.status, "Closed Won"),
                ne(leads.status, "Closed Lost"),
                eq(leads.isArchived, false)
            ),
            with: { assignees: true },
        })).filter(l => l.assignees.length === 0)
        : [];

    // 3. Blocked / Overdue Tasks (Delivery)
    const blockedOrOverdueTasks = isDelivery
        ? (await db.query.tasks.findMany({
            where: and(
                isNull(tasks.deletedAt),
                ne(tasks.status, "Done"),
                or(
                    eq(tasks.status, "Blocked"),
                    lt(tasks.dueDate, now)
                )
            ),
            with: {
                project: true,
                assignees: { with: { user: true } }
            },
        })).filter(t => !t.project?.isArchived)
        : [];

    // 4. Pending Client Approvals (Delivery/Manager)
    const pendingApprovals = isDelivery
        ? (await db.query.milestones.findMany({
            where: and(
                eq(milestones.status, "Client Approval"),
                isNull(milestones.deletedAt)
            ),
            with: {
                project: true
            }
        })).filter(m => !m.project?.isArchived)
        : [];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h2 className="text-3xl font-black tracking-tight text-glow">Daily Overview</h2>
                <p className="text-muted-foreground text-sm">Your immediate priorities and tasks requiring attention.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* SALES & CRM COLUMN */}
                {isSales && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold flex items-center gap-2 border-b border-border pb-2">
                            <UserX className="w-5 h-5 text-primary" /> CRM & Leads
                        </h3>

                        {/* Unassigned Leads */}
                        <Card className="glass-card border-border shadow-xs">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-500" />
                                        Unassigned Leads
                                    </span>
                                    <Badge variant="secondary">{unassignedLeads.length}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {unassignedLeads.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No unassigned leads.</p>
                                ) : (
                                    unassignedLeads.slice(0, 10).map(lead => (
                                        <Link key={lead.id} href={`/dashboard/leads?leadId=${lead.id}`} className="block group">
                                            <div className="p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors flex justify-between items-center">
                                                <div>
                                                    <p className="font-medium text-sm group-hover:text-primary transition-colors">{lead.businessName || lead.contactName || "Unknown Lead"}</p>
                                                    <p className="text-xs text-muted-foreground">{lead.status}</p>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </Link>
                                    ))
                                )}
                                {unassignedLeads.length > 10 && <p className="text-xs text-muted-foreground">Showing 10 of {unassignedLeads.length} leads.</p>}
                            </CardContent>
                        </Card>

                        {/* Overdue Follow-ups */}
                        <Card className="glass-card border-border shadow-xs">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-destructive" />
                                        Overdue Follow-ups
                                    </span>
                                    <Badge variant="secondary">{overdueLeads.length}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {overdueLeads.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No overdue follow-ups.</p>
                                ) : (
                                    overdueLeads.slice(0, 10).map(lead => (
                                        <Link key={lead.id} href={`/dashboard/leads?leadId=${lead.id}`} className="block group">
                                            <div className="p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors flex justify-between items-center">
                                                <div>
                                                    <p className="font-medium text-sm group-hover:text-primary transition-colors">{lead.businessName || lead.contactName || "Unknown Lead"}</p>
                                                    <p className="text-xs text-destructive">
                                                        Overdue: {format(new Date(lead.nextFollowUpDate!), "MMM d, yyyy")}
                                                    </p>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </Link>
                                    ))
                                )}
                                {overdueLeads.length > 10 && <p className="text-xs text-muted-foreground">Showing 10 of {overdueLeads.length} follow-ups.</p>}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* DELIVERY & PM COLUMN */}
                {isDelivery && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold flex items-center gap-2 border-b border-border pb-2">
                            <CheckCircle className="w-5 h-5 text-primary" /> Projects & Delivery
                        </h3>

                        {/* Pending Approvals */}
                        <Card className="glass-card border-border shadow-xs">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                                        Pending Client Approvals
                                    </span>
                                    <Badge variant="secondary">{pendingApprovals.length}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {pendingApprovals.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No pending approvals.</p>
                                ) : (
                                    pendingApprovals.slice(0, 10).map(ms => (
                                        <Link key={ms.id} href={`/dashboard/pm/${ms.projectId}`} className="block group">
                                            <div className="p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors flex justify-between items-center">
                                                <div>
                                                    <p className="font-medium text-sm group-hover:text-primary transition-colors">{ms.title}</p>
                                                    <p className="text-xs text-muted-foreground">{ms.project?.title}</p>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </Link>
                                    ))
                                )}
                                {pendingApprovals.length > 10 && <p className="text-xs text-muted-foreground">Showing 10 of {pendingApprovals.length} approvals.</p>}
                            </CardContent>
                        </Card>

                        {/* Blocked / Overdue Tasks */}
                        <Card className="glass-card border-border shadow-xs">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-destructive" />
                                        Blocked & Overdue Tasks
                                    </span>
                                    <Badge variant="secondary">{blockedOrOverdueTasks.length}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {blockedOrOverdueTasks.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">All tasks are on track.</p>
                                ) : (
                                    blockedOrOverdueTasks.slice(0, 15).map(task => {
                                        const isBlocked = task.status === "Blocked";
                                        return (
                                            <Link key={task.id} href={`/dashboard/pm/${task.projectId}`} className="block group">
                                                <div className={`p-3 rounded-lg border ${isBlocked ? 'border-destructive/50 bg-destructive/10' : 'border-border bg-muted/20'} hover:bg-muted/40 transition-colors flex justify-between items-center`}>
                                                    <div>
                                                        <p className="font-medium text-sm group-hover:text-primary transition-colors">{task.title}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {isBlocked && <Badge variant="destructive" className="h-4 px-1 text-[9px]">Blocked</Badge>}
                                                            {!isBlocked && task.dueDate && <span className="text-[10px] text-destructive uppercase font-bold tracking-wider">Overdue</span>}
                                                            <span className="text-xs text-muted-foreground">{task.project?.title}</span>
                                                        </div>
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </Link>
                                        );
                                    })
                                )}
                                {blockedOrOverdueTasks.length > 15 && <p className="text-xs text-muted-foreground">Showing 15 of {blockedOrOverdueTasks.length} tasks.</p>}
                            </CardContent>
                        </Card>
                    </div>
                )}

            </div>
        </div>
    );
}
