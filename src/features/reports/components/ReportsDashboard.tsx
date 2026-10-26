"use client";

import { useState, useEffect } from "react";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { DateRange } from "react-day-picker";
import {
    startOfMonth,
    endOfMonth,
    subMonths,
    startOfQuarter,
    endOfQuarter,
    startOfYear,
    endOfYear,
    format
} from "date-fns";
import {
    getLeadConversionReport,
    getTeamVelocityReport,
    getProjectCompletionReport,
    type ProjectCompletionReportResult,
    type LeadConversionReportResult,
    type TeamVelocityReportResult,
    type UserVelocityItem,
} from "@/features/reports/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Download,
    Loader2,
    Printer,
    Briefcase,
    TrendingUp,
    CheckCircle2,
    Clock,
    Zap,
    BarChart3,
    DollarSign,
    Award,
    ArrowUpRight
} from "lucide-react";
import Link from "next/link";

export function ReportsDashboard({ hideHeader }: { hideHeader?: boolean }) {
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });

    const [leadReport, setLeadReport] = useState<LeadConversionReportResult | null>(null);
    const [velocityReport, setVelocityReport] = useState<TeamVelocityReportResult | null>(null);
    const [projectReport, setProjectReport] = useState<ProjectCompletionReportResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (date?.from && date?.to) {
            fetchReports(date.from, date.to);
        }
    }, [date]);

    async function fetchReports(from: Date, to: Date) {
        setLoading(true);
        try {
            const dateRange = { from, to };
            const [leads, velocity, projects] = await Promise.all([
                getLeadConversionReport(dateRange),
                getTeamVelocityReport(dateRange),
                getProjectCompletionReport(dateRange),
            ]);
            setLeadReport(leads);
            setVelocityReport(velocity);
            setProjectReport(projects);
        } catch (error) {
            console.error("Failed to fetch reports", error);
        } finally {
            setLoading(false);
        }
    }

    const setPreset = (preset: "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear") => {
        const today = new Date();
        switch (preset) {
            case "thisMonth":
                setDate({ from: startOfMonth(today), to: endOfMonth(today) });
                break;
            case "lastMonth":
                const lastM = subMonths(today, 1);
                setDate({ from: startOfMonth(lastM), to: endOfMonth(lastM) });
                break;
            case "thisQuarter":
                setDate({ from: startOfQuarter(today), to: endOfQuarter(today) });
                break;
            case "thisYear":
                setDate({ from: startOfYear(today), to: endOfYear(today) });
                break;
        }
    };

    const handleExport = () => {
        if (!leadReport || !velocityReport || !projectReport) return;

        const fromStr = date?.from ? format(date.from, "yyyy-MM-dd") : "Start";
        const toStr = date?.to ? format(date.to, "yyyy-MM-dd") : "End";

        let csv = `OPTRIZO DIGITAL SOLUTIONS - EXECUTIVE OPERATIONS REPORT\n`;
        csv += `Reporting Period,${fromStr} to ${toStr}\n`;
        csv += `Generated At,${new Date().toISOString()}\n\n`;

        // 1. Project Completion & Delivery
        csv += `=== 1. PROJECT COMPLETION & DELIVERY REPORT ===\n`;
        csv += `Metric,Value\n`;
        csv += `Total Projects Completed,${projectReport.totalProjectsCompleted}\n`;
        csv += `On-Time Delivery Rate %,${projectReport.onTimeDeliveryRate.toFixed(1)}%\n`;
        csv += `Average Project Duration (Days),${projectReport.averageProjectDurationDays.toFixed(1)}\n`;
        csv += `Total Value Delivered,$${projectReport.totalValueDelivered.toLocaleString()}\n`;
        csv += `Total Milestones Completed,${projectReport.totalMilestonesCompleted}\n`;
        csv += `Total Story Points Delivered,${projectReport.totalStoryPointsDelivered}\n\n`;

        csv += `Completed Projects List\n`;
        csv += `Project Title,Client,Company,Start Date,Completion Date,Target Date,Duration (Days),On-Time Status,Milestones,Story Points,Contract Value\n`;
        projectReport.projects.forEach(p => {
            const cleanTitle = p.title.replace(/,/g, ' ');
            const cleanClient = p.clientName.replace(/,/g, ' ');
            const cleanCompany = p.companyName.replace(/,/g, ' ');
            const onTimeText = p.isOnTime ? "On Time" : "Delayed";
            const targetStr = p.targetDate ? p.targetDate.slice(0, 10) : "N/A";
            csv += `"${cleanTitle}","${cleanClient}","${cleanCompany}",${p.startDate.slice(0, 10)},${p.completedDate.slice(0, 10)},${targetStr},${p.durationDays},${onTimeText},${p.milestonesCompleted}/${p.totalMilestones},${p.totalStoryPoints},$${p.contractValue}\n`;
        });
        csv += `\n`;

        // 2. Sales & Lead Conversion
        csv += `=== 2. SALES & LEAD CONVERSION REPORT ===\n`;
        csv += `Metric,Value\n`;
        csv += `Total Cohort Leads,${leadReport.totalLeads}\n`;
        csv += `Won Leads,${leadReport.wonCount}\n`;
        csv += `Conversion Rate %,${leadReport.conversionRate.toFixed(2)}%\n`;
        csv += `Avg Sales Conversion Time (Days),${leadReport.averageConversionTimeDays.toFixed(1)}\n`;
        csv += `Total Won Value,$${leadReport.totalWonValue.toLocaleString()}\n\n`;

        // 3. Team Velocity
        csv += `=== 3. TEAM TASK VELOCITY REPORT ===\n`;
        csv += `Metric,Value\n`;
        csv += `Total Completed Tasks,${velocityReport.totalCompletedTasks}\n`;
        csv += `Total Story Points (Weight),${velocityReport.totalWeight}\n`;
        csv += `Avg Task Turnaround Time (Days),${velocityReport.averageTurnaroundTimeDays.toFixed(1)}\n\n`;

        csv += `User Velocity Breakdown\n`;
        csv += `Team Member,Tasks Completed,Story Points\n`;
        velocityReport.userVelocity.forEach((uv: UserVelocityItem) => {
            const cleanName = uv.name.replace(/,/g, ' ');
            csv += `"${cleanName}",${uv.tasksCompleted},${uv.totalWeight}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', `optrizo-operations-report-${fromStr}-to-${toStr}.csv`);
        a.click();
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Print Header (Visible only when printed) */}
            <div className="hidden print:block mb-8 pb-4 border-b-2 border-foreground">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-wider text-foreground">Optrizo Digital Solutions</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">Executive Operational & Delivery Performance Audit Report</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                        <p>Reporting Period: {date?.from ? format(date.from, "PPP") : ""} — {date?.to ? format(date.to, "PPP") : ""}</p>
                        <p>Generated: {format(new Date(), "PPPpp")}</p>
                    </div>
                </div>
            </div>

            {/* Standard Dashboard Header */}
            {!hideHeader && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <BarChart3 className="w-5 h-5 text-primary" />
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                                Detailed Reports & Delivery Analytics
                            </h1>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Audit project delivery milestones, sales conversion velocity, and team throughput.
                        </p>
                    </div>
                </div>
            )}

            {/* Date Controls & Action Buttons */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-border pb-5 print:hidden">
                <div className="flex gap-2">
                    <Button onClick={handleExport} variant="default" size="sm" className="gap-2 shadow-sm" disabled={loading}>
                        <Download className="w-4 h-4" /> Export CSV
                    </Button>
                    <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2" disabled={loading}>
                        <Printer className="w-4 h-4" /> Print Report
                    </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreset("thisMonth")}>This Month</Button>
                    <Button variant="outline" size="sm" onClick={() => setPreset("lastMonth")}>Last Month</Button>
                    <Button variant="outline" size="sm" onClick={() => setPreset("thisQuarter")}>Quarter</Button>
                    <Button variant="outline" size="sm" onClick={() => setPreset("thisYear")}>Annual</Button>
                    <DatePickerWithRange date={date} setDate={setDate} />
                </div>
            </div>

            {loading ? (
                <div className="h-72 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Aggregating delivery telemetry and financial records...</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Top Executive Scorecard Banner */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 1. Projects Delivered */}
                        <div className="glass-card border border-border rounded-xl p-5 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projects Delivered</span>
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                    <Briefcase className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-3xl font-extrabold text-foreground mb-1">
                                {projectReport?.totalProjectsCompleted ?? 0}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px] font-medium py-0">
                                    {projectReport?.onTimeDeliveryRate.toFixed(0)}% On-Time
                                </Badge>
                                <span className="text-muted-foreground text-[11px]">in selected cohort</span>
                            </div>
                        </div>

                        {/* 2. Value Delivered */}
                        <div className="glass-card border border-border rounded-xl p-5 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Delivered Value</span>
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <DollarSign className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-3xl font-extrabold text-foreground mb-1">
                                ${((projectReport?.totalValueDelivered ?? 0)).toLocaleString()}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Completed client contract revenue
                            </p>
                        </div>

                        {/* 3. Lead Conversion Rate */}
                        <div className="glass-card border border-border rounded-xl p-5 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lead Win Rate</span>
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                    <TrendingUp className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-3xl font-extrabold text-foreground mb-1">
                                {leadReport?.conversionRate.toFixed(1)}%
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {leadReport?.wonCount ?? 0} deals won of {leadReport?.totalLeads ?? 0} leads
                            </p>
                        </div>

                        {/* 4. Engineering Velocity */}
                        <div className="glass-card border border-border rounded-xl p-5 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shipped Velocity</span>
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                                    <Zap className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-3xl font-extrabold text-foreground mb-1">
                                {velocityReport?.totalWeight ?? 0} <span className="text-sm font-normal text-muted-foreground">Pts</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {velocityReport?.totalCompletedTasks ?? 0} tasks delivered by team
                            </p>
                        </div>
                    </div>

                    {/* Reporting Pillar Tabs */}
                    <Tabs defaultValue="projects" className="space-y-6">
                        <TabsList className="bg-muted/50 p-1 border border-border print:hidden">
                            <TabsTrigger value="projects" className="gap-2">
                                <Briefcase className="w-4 h-4 text-emerald-500" />
                                Project Delivery & Completion
                            </TabsTrigger>
                            <TabsTrigger value="sales" className="gap-2">
                                <TrendingUp className="w-4 h-4 text-primary" />
                                Sales & Lead Conversion
                            </TabsTrigger>
                            <TabsTrigger value="velocity" className="gap-2">
                                <Zap className="w-4 h-4 text-purple-500" />
                                Team Velocity & Throughput
                            </TabsTrigger>
                        </TabsList>

                        {/* TAB 1: PROJECT COMPLETION & DELIVERY (Objective 1.f Core Solution) */}
                        <TabsContent value="projects" className="space-y-6 m-0 print:block">
                            <div className="glass-card border border-border rounded-xl p-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                            <Briefcase className="w-5 h-5 text-emerald-500" />
                                            Project Completion Performance
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            Aggregated statistics of all client projects completed or archived within this reporting period.
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="border-border text-xs">
                                        Cohort: {projectReport?.totalProjectsCompleted ?? 0} Projects Finished
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Projects Finished</p>
                                        <p className="text-2xl font-bold text-foreground mt-1">{projectReport?.totalProjectsCompleted ?? 0}</p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">On-Time Delivery</p>
                                        <p className="text-2xl font-bold text-emerald-500 mt-1">{projectReport?.onTimeDeliveryRate.toFixed(1)}%</p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Avg Project Cycle</p>
                                        <p className="text-2xl font-bold text-foreground mt-1">{projectReport?.averageProjectDurationDays.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">Days</span></p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Total Contract Value</p>
                                        <p className="text-2xl font-bold text-primary mt-1">${(projectReport?.totalValueDelivered ?? 0).toLocaleString()}</p>
                                    </div>
                                </div>

                                {/* Completed Projects Audit Table */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">
                                        Completed Client Projects Audit Trail
                                    </h3>
                                    {projectReport?.projects && projectReport.projects.length > 0 ? (
                                        <div className="rounded-lg border border-border overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-muted/40">
                                                    <TableRow>
                                                        <TableHead className="font-semibold">Project Title</TableHead>
                                                        <TableHead className="font-semibold">Client / Company</TableHead>
                                                        <TableHead className="font-semibold text-center">Milestones</TableHead>
                                                        <TableHead className="font-semibold text-center">Story Points</TableHead>
                                                        <TableHead className="font-semibold text-center">Duration</TableHead>
                                                        <TableHead className="font-semibold text-center">Status</TableHead>
                                                        <TableHead className="font-semibold text-right">Contract Value</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {projectReport.projects.map((proj) => (
                                                        <TableRow key={proj.id} className="hover:bg-muted/30">
                                                            <TableCell className="font-medium text-foreground">
                                                                <Link 
                                                                    href={`/dashboard/pm/${proj.id}`} 
                                                                    className="hover:text-primary transition-colors inline-flex items-center gap-1"
                                                                >
                                                                    {proj.title}
                                                                    <ArrowUpRight className="w-3.5 h-3.5 opacity-60 print:hidden" />
                                                                </Link>
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground">
                                                                <div className="font-medium text-foreground">{proj.companyName}</div>
                                                                <div className="text-xs text-muted-foreground">{proj.clientName}</div>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant="outline" className="text-xs font-mono">
                                                                    {proj.milestonesCompleted}/{proj.totalMilestones}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-center font-mono text-xs">
                                                                {proj.totalStoryPoints} Pts
                                                            </TableCell>
                                                            <TableCell className="text-center text-xs text-muted-foreground">
                                                                {proj.durationDays} Days
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                {proj.isOnTime ? (
                                                                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs gap-1">
                                                                        <CheckCircle2 className="w-3 h-3" /> On Time
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="destructive" className="text-xs gap-1">
                                                                        <Clock className="w-3 h-3" /> Delayed
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-foreground">
                                                                ${proj.contractValue.toLocaleString()}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center border border-dashed border-border rounded-lg bg-muted/20">
                                            <Briefcase className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                                            <p className="text-sm font-medium text-foreground">No completed projects found in this timeframe</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Try adjusting the date range preset above to view earlier completed or archived client projects.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB 2: SALES & LEAD CONVERSION */}
                        <TabsContent value="sales" className="space-y-6 m-0 print:block">
                            <div className="glass-card border border-border rounded-xl p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-primary" />
                                            Sales & Lead Conversion Analytics
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            Cohort analysis of inquiries received and converted into paying contracts.
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Cohort Inquiries</p>
                                        <p className="text-2xl font-bold text-foreground mt-1">{leadReport?.totalLeads ?? 0}</p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Deals Won</p>
                                        <p className="text-2xl font-bold text-emerald-500 mt-1">{leadReport?.wonCount ?? 0}</p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Conversion Rate</p>
                                        <p className="text-2xl font-bold text-primary mt-1">{leadReport?.conversionRate?.toFixed(1) ?? "0.0"}%</p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Avg Sales Cycle</p>
                                        <p className="text-2xl font-bold text-foreground mt-1">{leadReport?.averageConversionTimeDays?.toFixed(1) ?? "0.0"} <span className="text-xs font-normal text-muted-foreground">Days</span></p>
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Award className="w-6 h-6 text-primary" />
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">Total Closed Won Revenue</p>
                                            <p className="text-xs text-muted-foreground">Cumulative value from converted prospective leads</p>
                                        </div>
                                    </div>
                                    <span className="text-2xl font-extrabold text-foreground">
                                        ${(leadReport?.totalWonValue ?? 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB 3: TEAM VELOCITY & THROUGHPUT */}
                        <TabsContent value="velocity" className="space-y-6 m-0 print:block">
                            <div className="glass-card border border-border rounded-xl p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                            <Zap className="w-5 h-5 text-purple-500" />
                                            Team Engineering Throughput & Velocity
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            Task turnaround time and capacity distribution across developers and project teams.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Tasks Delivered</p>
                                        <p className="text-2xl font-bold text-foreground mt-1">{velocityReport?.totalCompletedTasks ?? 0}</p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Story Points Shipped</p>
                                        <p className="text-2xl font-bold text-purple-500 mt-1">{velocityReport?.totalWeight ?? 0}</p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Avg Turnaround Time</p>
                                        <p className="text-2xl font-bold text-foreground mt-1">{velocityReport?.averageTurnaroundTimeDays?.toFixed(1) ?? "0.0"} <span className="text-xs font-normal text-muted-foreground">Days</span></p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">Developer Throughput Breakdown</h3>
                                    {velocityReport?.userVelocity && velocityReport.userVelocity.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {velocityReport.userVelocity.map((uv: UserVelocityItem) => (
                                                <div key={uv.name} className="flex justify-between items-center p-3.5 border border-border rounded-lg bg-background/50">
                                                    <span className="font-medium text-foreground text-sm">{uv.name}</span>
                                                    <div className="text-right">
                                                        <span className="text-xs font-semibold text-foreground block">{uv.tasksCompleted} Tasks</span>
                                                        <span className="text-[11px] text-muted-foreground">{uv.totalWeight} Story Points</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground p-4 text-center border border-dashed border-border rounded-lg">
                                            No completed tasks logged for this date range.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            )}

            {/* Official Print Sign-off Block (Visible only when printed) */}
            <div className="hidden print:grid grid-cols-2 gap-12 mt-16 pt-8 border-t border-foreground text-xs text-foreground">
                <div>
                    <div className="border-b border-foreground mb-2 h-12"></div>
                    <p className="font-bold">Prepared By:</p>
                    <p className="text-muted-foreground">Operations & Project Management Lead</p>
                </div>
                <div>
                    <div className="border-b border-foreground mb-2 h-12"></div>
                    <p className="font-bold">Approved By:</p>
                    <p className="text-muted-foreground">Executive Director / Agency Principal</p>
                </div>
            </div>
        </div>
    );
}
