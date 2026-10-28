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
    ArrowUpRight,
    Sparkles,
    AlertTriangle,
    Layers,
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

    const setPreset = (preset: "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear" | "allTime") => {
        const today = new Date();
        switch (preset) {
            case "thisMonth":
                setDate({ from: startOfMonth(today), to: endOfMonth(today) });
                break;
            case "lastMonth": {
                const lastM = subMonths(today, 1);
                setDate({ from: startOfMonth(lastM), to: endOfMonth(lastM) });
                break;
            }
            case "thisQuarter":
                setDate({ from: startOfQuarter(today), to: endOfQuarter(today) });
                break;
            case "thisYear":
                setDate({ from: startOfYear(today), to: endOfYear(today) });
                break;
            case "allTime":
                setDate({ from: new Date(2025, 0, 1), to: endOfYear(today) });
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
        csv += `=== 1. PROJECT DELIVERY & COMPLETION REPORT ===\n`;
        csv += `Metric,Value\n`;
        csv += `Total Portfolio Projects,${projectReport.totalPortfolioProjects}\n`;
        csv += `Completed Projects,${projectReport.totalProjectsCompleted}\n`;
        csv += `Active Delivery Projects,${projectReport.activeProjectsCount}\n`;
        csv += `Average Portfolio Progress %,${projectReport.averageProgress}%\n`;
        csv += `On-Time / On-Track Rate %,${projectReport.onTimeDeliveryRate.toFixed(1)}%\n`;
        csv += `Average Project Duration (Days),${projectReport.averageProjectDurationDays.toFixed(1)}\n`;
        csv += `Total Contract Value,$${projectReport.totalContractValue.toLocaleString()}\n`;
        csv += `Total Earned Value (Progress-Weighted),$${projectReport.totalEarnedValue.toLocaleString()}\n`;
        csv += `Total Completed Value Delivered,$${projectReport.totalValueDelivered.toLocaleString()}\n`;
        csv += `Milestones Completed,${projectReport.totalMilestonesCompleted}/${projectReport.totalMilestones}\n`;
        csv += `Story Points Delivered,${projectReport.totalStoryPointsDelivered}/${projectReport.totalStoryPointsScoped}\n\n`;

        csv += `Portfolio Projects Audit Trail\n`;
        csv += `Project Title,Client,Company,Stage,Progress %,Start Date,Last Updated,Target Date,Duration (Days),Schedule Status,Milestones,Story Points,Earned Value,Contract Value\n`;
        projectReport.projects.forEach(p => {
            const cleanTitle = p.title.replace(/,/g, " ");
            const cleanClient = p.clientName.replace(/,/g, " ");
            const cleanCompany = p.companyName.replace(/,/g, " ");
            const targetStr = p.targetDate ? p.targetDate.slice(0, 10) : "N/A";
            csv += `"${cleanTitle}","${cleanClient}","${cleanCompany}",${p.status},${p.progress}%,${p.startDate.slice(0, 10)},${p.completedDate.slice(0, 10)},${targetStr},${p.durationDays},${p.scheduleStatus},${p.milestonesCompleted}/${p.totalMilestones},${p.deliveredStoryPoints}/${p.totalStoryPoints},$${p.earnedValue},$${p.contractValue}\n`;
        });
        csv += `\n`;

        // 2. Sales & Lead Conversion
        csv += `=== 2. SALES & LEAD CONVERSION REPORT ===\n`;
        csv += `Metric,Value\n`;
        csv += `Total Cohort Leads,${leadReport.totalLeads}\n`;
        csv += `Won Leads,${leadReport.wonCount}\n`;
        csv += `Active Cohort Leads,${leadReport.activeCount}\n`;
        csv += `Lost Leads,${leadReport.lostCount}\n`;
        csv += `Cohort Conversion Rate %,${leadReport.conversionRate.toFixed(2)}%\n`;
        csv += `Closed Deal Win Rate %,${leadReport.winRateOnClosed.toFixed(2)}%\n`;
        csv += `Avg Sales Conversion Time (Days),${leadReport.averageConversionTimeDays.toFixed(1)}\n`;
        csv += `Total Won Revenue,$${leadReport.totalWonValue.toLocaleString()}\n`;
        csv += `Active Cohort Pipeline Value,$${leadReport.totalPipelineValue.toLocaleString()}\n\n`;

        csv += `Acquisition Channel Breakdown\n`;
        csv += `Source,Inquiries,Won,Active,Lost,Win Rate %,Won Revenue,Pipeline Value\n`;
        leadReport.sourceBreakdown.forEach(s => {
            csv += `"${s.source.replace(/,/g, " ")}",${s.inquiries},${s.won},${s.active},${s.lost},${s.winRate.toFixed(1)}%,$${s.revenue},$${s.pipelineValue}\n`;
        });
        csv += `\n`;

        // 3. Team Velocity
        csv += `=== 3. TEAM TASK VELOCITY REPORT ===\n`;
        csv += `Metric,Value\n`;
        csv += `Total Completed Tasks,${velocityReport.totalCompletedTasks}\n`;
        csv += `Total Story Points (Weight),${velocityReport.totalWeight}\n`;
        csv += `Avg Task Turnaround Time (Days),${velocityReport.averageTurnaroundTimeDays.toFixed(1)}\n`;
        csv += `Avg AI Quality Score,${velocityReport.averageAiQualityScore !== null ? `${velocityReport.averageAiQualityScore}/100` : "N/A"}\n\n`;

        csv += `User Velocity Breakdown\n`;
        csv += `Team Member,Role,Tasks Completed,Story Points,Avg Turnaround (Days),Avg AI Quality Score\n`;
        velocityReport.userVelocity.forEach((uv: UserVelocityItem) => {
            const cleanName = uv.name.replace(/,/g, " ");
            csv += `"${cleanName}",${uv.role},${uv.tasksCompleted},${uv.totalWeight},${uv.avgTurnaroundDays ?? "N/A"},${uv.avgQualityScore ?? "N/A"}\n`;
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.setAttribute("href", url);
        a.setAttribute("download", `optrizo-operations-report-${fromStr}-to-${toStr}.csv`);
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
                    <Button variant="outline" size="sm" onClick={() => setPreset("allTime")}>All Time</Button>
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
                        {/* 1. Delivery Portfolio */}
                        <div className="glass-card border border-border rounded-xl p-5 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Delivery Portfolio</span>
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                    <Briefcase className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-3xl font-extrabold text-foreground mb-1 flex items-baseline gap-2">
                                {projectReport?.totalPortfolioProjects ?? 0}
                                <span className="text-xs font-medium text-muted-foreground">
                                    ({projectReport?.totalProjectsCompleted ?? 0} Done · {projectReport?.activeProjectsCount ?? 0} Active)
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs flex-wrap">
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px] font-medium py-0">
                                    {projectReport?.onTimeDeliveryRate.toFixed(0)}% On-Schedule
                                </Badge>
                                <span className="text-muted-foreground text-[11px]">
                                    Avg {projectReport?.averageProgress ?? 0}% complete
                                </span>
                            </div>
                        </div>

                        {/* 2. Earned & Contract Value */}
                        <div className="glass-card border border-border rounded-xl p-5 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Earned Delivery Value</span>
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <DollarSign className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-3xl font-extrabold text-foreground mb-1">
                                ${(projectReport?.totalEarnedValue ?? 0).toLocaleString()}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Of ${(projectReport?.totalContractValue ?? 0).toLocaleString()} active &amp; completed contracts
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
                                {leadReport?.wonCount ?? 0} won · {leadReport?.activeCount ?? 0} active · {leadReport?.lostCount ?? 0} lost ({leadReport?.totalLeads ?? 0} total)
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
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                <span>{velocityReport?.totalCompletedTasks ?? 0} tasks delivered</span>
                                {velocityReport?.averageAiQualityScore !== null && velocityReport?.averageAiQualityScore !== undefined && (
                                    <Badge variant="outline" className="text-[10px] py-0 border-purple-500/30 text-purple-400">
                                        AI QA {velocityReport.averageAiQualityScore}/100
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Reporting Pillar Tabs */}
                    <Tabs defaultValue="projects" className="space-y-6">
                        <TabsList className="bg-muted/50 p-1 border border-border print:hidden">
                            <TabsTrigger value="projects" className="gap-2">
                                <Briefcase className="w-4 h-4 text-emerald-500" />
                                Project Delivery &amp; Completion
                            </TabsTrigger>
                            <TabsTrigger value="sales" className="gap-2">
                                <TrendingUp className="w-4 h-4 text-primary" />
                                Sales &amp; Lead Conversion
                            </TabsTrigger>
                            <TabsTrigger value="velocity" className="gap-2">
                                <Zap className="w-4 h-4 text-purple-500" />
                                Team Velocity &amp; Throughput
                            </TabsTrigger>
                        </TabsList>

                        {/* TAB 1: PROJECT COMPLETION & DELIVERY */}
                        <TabsContent value="projects" className="space-y-6 m-0 print:block">
                            <div className="glass-card border border-border rounded-xl p-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                            <Briefcase className="w-5 h-5 text-emerald-500" />
                                            Project Delivery &amp; Completion Performance
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            Progress, milestone execution, story points delivered, and earned contract value across active and completed projects.
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="border-border text-xs">
                                        Portfolio: {projectReport?.totalProjectsCompleted ?? 0} Completed · {projectReport?.activeProjectsCount ?? 0} Active
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Milestones &amp; Scope</p>
                                        <p className="text-2xl font-bold text-foreground mt-1">
                                            {projectReport?.totalMilestonesCompleted ?? 0}<span className="text-sm font-normal text-muted-foreground">/{projectReport?.totalMilestones ?? 0}</span>
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            {projectReport?.totalStoryPointsDelivered ?? 0}/{projectReport?.totalStoryPointsScoped ?? 0} Story Points Done
                                        </p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Schedule Health</p>
                                        <p className="text-2xl font-bold text-emerald-500 mt-1">{projectReport?.onTimeDeliveryRate.toFixed(1)}%</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Avg Progress: {projectReport?.averageProgress ?? 0}%
                                        </p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Avg Delivery Cycle</p>
                                        <p className="text-2xl font-bold text-foreground mt-1">
                                            {projectReport?.averageProjectDurationDays.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">Days</span>
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Start to completion / active age
                                        </p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Earned / Contract Value</p>
                                        <p className="text-2xl font-bold text-primary mt-1">
                                            ${(projectReport?.totalEarnedValue ?? 0).toLocaleString()}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Of ${(projectReport?.totalContractValue ?? 0).toLocaleString()} total (${(projectReport?.totalValueDelivered ?? 0).toLocaleString()} closed)
                                        </p>
                                    </div>
                                </div>

                                {/* Portfolio Projects Audit Table */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">
                                        Client Projects Delivery &amp; Audit Trail
                                    </h3>
                                    {projectReport?.projects && projectReport.projects.length > 0 ? (
                                        <div className="rounded-lg border border-border overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-muted/40">
                                                    <TableRow>
                                                        <TableHead className="font-semibold">Project Title</TableHead>
                                                        <TableHead className="font-semibold">Client / Company</TableHead>
                                                        <TableHead className="font-semibold text-center">Progress</TableHead>
                                                        <TableHead className="font-semibold text-center">Milestones</TableHead>
                                                        <TableHead className="font-semibold text-center">Story Points</TableHead>
                                                        <TableHead className="font-semibold text-center">Duration</TableHead>
                                                        <TableHead className="font-semibold text-center">Schedule</TableHead>
                                                        <TableHead className="font-semibold text-right">Earned / Contract</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {projectReport.projects.map((proj) => (
                                                        <TableRow key={proj.id} className="hover:bg-muted/30">
                                                            <TableCell className="font-medium text-foreground">
                                                                <div className="flex flex-col gap-1">
                                                                    <Link
                                                                        href={`/dashboard/pm/${proj.id}`}
                                                                        className="hover:text-primary transition-colors inline-flex items-center gap-1 font-semibold"
                                                                    >
                                                                        {proj.title}
                                                                        <ArrowUpRight className="w-3.5 h-3.5 opacity-60 print:hidden" />
                                                                    </Link>
                                                                    <span className="text-[11px] text-muted-foreground">
                                                                        Stage: <span className="font-medium text-foreground/80">{proj.status}</span>
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground">
                                                                <div className="font-medium text-foreground">{proj.companyName}</div>
                                                                <div className="text-xs text-muted-foreground">{proj.clientName}</div>
                                                            </TableCell>
                                                            <TableCell className="text-center min-w-[120px]">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className="text-xs font-mono font-semibold text-foreground">{proj.progress}%</span>
                                                                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-emerald-500 rounded-full transition-all"
                                                                            style={{ width: `${Math.min(100, Math.max(0, proj.progress))}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant="outline" className="text-xs font-mono">
                                                                    {proj.milestonesCompleted}/{proj.totalMilestones}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-center font-mono text-xs">
                                                                {proj.deliveredStoryPoints}/{proj.totalStoryPoints} Pts
                                                            </TableCell>
                                                            <TableCell className="text-center text-xs text-muted-foreground">
                                                                {proj.durationDays} Days
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                {proj.isOnTime ? (
                                                                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs gap-1 whitespace-nowrap">
                                                                        <CheckCircle2 className="w-3 h-3" /> {proj.scheduleStatus}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="destructive" className="text-xs gap-1 whitespace-nowrap">
                                                                        <Clock className="w-3 h-3" /> {proj.scheduleStatus}
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="font-semibold text-foreground">
                                                                    ${proj.earnedValue.toLocaleString()}
                                                                </div>
                                                                <div className="text-[11px] text-muted-foreground">
                                                                    of ${proj.contractValue.toLocaleString()}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center border border-dashed border-border rounded-lg bg-muted/20">
                                            <Briefcase className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                                            <p className="text-sm font-medium text-foreground">No client projects found in this timeframe</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Try selecting the &quot;All Time&quot; or &quot;Annual&quot; preset above to view your full project portfolio.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB 2: SALES & LEAD CONVERSION */}
                        <TabsContent value="sales" className="space-y-6 m-0 print:block">
                            <div className="glass-card border border-border rounded-xl p-6 space-y-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-primary" />
                                            Sales &amp; Lead Conversion Analytics
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            Cohort analysis of inquiries, acquisition channel ROI, loss reasons, and deal conversion velocity.
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="border-border text-xs">
                                        Closed Win Rate: {leadReport?.winRateOnClosed?.toFixed(1) ?? "0.0"}% ({leadReport?.wonCount ?? 0}W / {leadReport?.lostCount ?? 0}L)
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Cohort Inquiries</p>
                                        <p className="text-2xl font-bold text-foreground mt-1">{leadReport?.totalLeads ?? 0}</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            {leadReport?.activeCount ?? 0} Active · {leadReport?.lostCount ?? 0} Lost
                                        </p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Deals Won</p>
                                        <p className="text-2xl font-bold text-emerald-500 mt-1">{leadReport?.wonCount ?? 0}</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Closed win rate: {leadReport?.winRateOnClosed?.toFixed(1) ?? "0.0"}%
                                        </p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Cohort Conversion</p>
                                        <p className="text-2xl font-bold text-primary mt-1">{leadReport?.conversionRate?.toFixed(1) ?? "0.0"}%</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Total inquiries to Closed Won
                                        </p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Avg Sales Cycle</p>
                                        <p className="text-2xl font-bold text-foreground mt-1">
                                            {leadReport?.averageConversionTimeDays?.toFixed(1) ?? "0.0"} <span className="text-xs font-normal text-muted-foreground">Days</span>
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Lead creation to contract close
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Award className="w-6 h-6 text-primary shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">Total Closed Won Revenue</p>
                                                <p className="text-xs text-muted-foreground">Realized contract revenue from won cohort deals</p>
                                            </div>
                                        </div>
                                        <span className="text-2xl font-extrabold text-foreground">
                                            ${(leadReport?.totalWonValue ?? 0).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Layers className="w-6 h-6 text-blue-500 shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">Active Cohort Pipeline</p>
                                                <p className="text-xs text-muted-foreground">Open pipeline value from {leadReport?.activeCount ?? 0} active cohort leads</p>
                                            </div>
                                        </div>
                                        <span className="text-2xl font-extrabold text-foreground">
                                            ${(leadReport?.totalPipelineValue ?? 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Acquisition Source / Channel Performance Table */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">
                                        Acquisition Channel &amp; Source ROI Breakdown
                                    </h3>
                                    {leadReport?.sourceBreakdown && leadReport.sourceBreakdown.length > 0 ? (
                                        <div className="rounded-lg border border-border overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-muted/40">
                                                    <TableRow>
                                                        <TableHead className="font-semibold">Acquisition Source</TableHead>
                                                        <TableHead className="font-semibold text-center">Inquiries</TableHead>
                                                        <TableHead className="font-semibold text-center">Won</TableHead>
                                                        <TableHead className="font-semibold text-center">Active</TableHead>
                                                        <TableHead className="font-semibold text-center">Lost</TableHead>
                                                        <TableHead className="font-semibold text-center">Win Rate</TableHead>
                                                        <TableHead className="font-semibold text-right">Active Pipeline</TableHead>
                                                        <TableHead className="font-semibold text-right">Won Revenue</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {leadReport.sourceBreakdown.map((src) => (
                                                        <TableRow key={src.source} className="hover:bg-muted/30">
                                                            <TableCell className="font-medium text-foreground">{src.source}</TableCell>
                                                            <TableCell className="text-center font-mono text-xs">{src.inquiries}</TableCell>
                                                            <TableCell className="text-center font-mono text-xs text-emerald-500 font-semibold">{src.won}</TableCell>
                                                            <TableCell className="text-center font-mono text-xs text-blue-500">{src.active}</TableCell>
                                                            <TableCell className="text-center font-mono text-xs text-rose-500">{src.lost}</TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant="outline" className="text-xs font-mono">
                                                                    {src.winRate.toFixed(1)}%
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs text-muted-foreground font-mono">
                                                                ${src.pipelineValue.toLocaleString()}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-foreground">
                                                                ${src.revenue.toLocaleString()}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground p-4 text-center border border-dashed border-border rounded-lg">
                                            No lead source data recorded for this period.
                                        </p>
                                    )}
                                </div>

                                {/* Loss Reason Breakdown (if any Closed Lost leads exist) */}
                                {leadReport?.lossReasonBreakdown && leadReport.lossReasonBreakdown.length > 0 && (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase flex items-center gap-1.5">
                                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                                            Closed Lost Reason Analysis
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {leadReport.lossReasonBreakdown.map((item) => (
                                                <div key={item.reason} className="flex justify-between items-center p-3.5 border border-border rounded-lg bg-background/50">
                                                    <div>
                                                        <span className="font-medium text-foreground text-sm block">{item.reason}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {item.count} {item.count === 1 ? "deal" : "deals"} ({item.percentage.toFixed(0)}% of losses)
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-semibold text-rose-500 block">
                                                            ${item.lostValue.toLocaleString()}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">Lost Value</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Cohort Deals Audit Table */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">
                                        Cohort Deals Audit Trail
                                    </h3>
                                    {leadReport?.cohortDeals && leadReport.cohortDeals.length > 0 ? (
                                        <div className="rounded-lg border border-border overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-muted/40">
                                                    <TableRow>
                                                        <TableHead className="font-semibold">Company / Deal</TableHead>
                                                        <TableHead className="font-semibold">Source</TableHead>
                                                        <TableHead className="font-semibold text-center">Stage</TableHead>
                                                        <TableHead className="font-semibold text-center">Created</TableHead>
                                                        <TableHead className="font-semibold text-center">Sales Cycle</TableHead>
                                                        <TableHead className="font-semibold text-right">Effective Value</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {leadReport.cohortDeals.map((deal) => (
                                                        <TableRow key={deal.id} className="hover:bg-muted/30">
                                                            <TableCell>
                                                                <div className="font-medium text-foreground">{deal.businessName}</div>
                                                                <div className="text-xs text-muted-foreground">{deal.contactName}</div>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">{deal.source}</TableCell>
                                                            <TableCell className="text-center">
                                                                {deal.status === "Closed Won" ? (
                                                                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">
                                                                        Closed Won
                                                                    </Badge>
                                                                ) : deal.status === "Closed Lost" ? (
                                                                    <Badge variant="destructive" className="text-xs">
                                                                        Closed Lost{deal.lossReason ? ` (${deal.lossReason})` : ""}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {deal.status}
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-center text-xs text-muted-foreground">
                                                                {deal.createdAt.slice(0, 10)}
                                                            </TableCell>
                                                            <TableCell className="text-center text-xs font-mono text-muted-foreground">
                                                                {deal.cycleDays !== null ? `${deal.cycleDays}d` : "—"}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-foreground">
                                                                ${deal.effectiveValue.toLocaleString()}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground p-4 text-center border border-dashed border-border rounded-lg">
                                            No cohort deals found for this date range.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB 3: TEAM VELOCITY & THROUGHPUT */}
                        <TabsContent value="velocity" className="space-y-6 m-0 print:block">
                            <div className="glass-card border border-border rounded-xl p-6 space-y-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                            <Zap className="w-5 h-5 text-purple-500" />
                                            Team Engineering Throughput &amp; Velocity
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            Task turnaround time, story point delivery, and AI quality score distribution across the engineering team.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                                        <p className="text-2xl font-bold text-foreground mt-1">
                                            {velocityReport?.averageTurnaroundTimeDays?.toFixed(1) ?? "0.0"} <span className="text-xs font-normal text-muted-foreground">Days</span>
                                        </p>
                                    </div>
                                    <div className="p-4 bg-muted/40 border border-border/50 rounded-lg">
                                        <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                                            <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Avg AI Quality Score
                                        </p>
                                        <p className="text-2xl font-bold text-foreground mt-1">
                                            {velocityReport?.averageAiQualityScore !== null && velocityReport?.averageAiQualityScore !== undefined
                                                ? `${velocityReport.averageAiQualityScore}/100`
                                                : "N/A"}
                                        </p>
                                    </div>
                                </div>

                                {/* Developer Throughput Breakdown Table */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">
                                        Developer Throughput &amp; Quality Breakdown
                                    </h3>
                                    {velocityReport?.userVelocity && velocityReport.userVelocity.length > 0 ? (
                                        <div className="rounded-lg border border-border overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-muted/40">
                                                    <TableRow>
                                                        <TableHead className="font-semibold">Team Member</TableHead>
                                                        <TableHead className="font-semibold text-center">Role</TableHead>
                                                        <TableHead className="font-semibold text-center">Tasks Completed</TableHead>
                                                        <TableHead className="font-semibold text-center">Story Points</TableHead>
                                                        <TableHead className="font-semibold text-center">Avg Turnaround</TableHead>
                                                        <TableHead className="font-semibold text-right">Avg AI Quality</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {velocityReport.userVelocity.map((uv: UserVelocityItem) => (
                                                        <TableRow key={uv.name} className="hover:bg-muted/30">
                                                            <TableCell className="font-medium text-foreground">{uv.name}</TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant="outline" className="text-xs capitalize">
                                                                    {uv.role}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-center font-mono text-xs font-semibold">
                                                                {uv.tasksCompleted}
                                                            </TableCell>
                                                            <TableCell className="text-center font-mono text-xs text-purple-400 font-semibold">
                                                                {uv.totalWeight} Pts
                                                            </TableCell>
                                                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                                                {uv.avgTurnaroundDays !== null ? `${uv.avgTurnaroundDays} Days` : "—"}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {uv.avgQualityScore !== null ? (
                                                                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs font-mono">
                                                                        {uv.avgQualityScore}/100
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground">—</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground p-4 text-center border border-dashed border-border rounded-lg">
                                            No completed tasks logged for this date range.
                                        </p>
                                    )}
                                </div>

                                {/* Completed Tasks Audit Table */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">
                                        Completed Tasks &amp; Deliverables Audit Trail
                                    </h3>
                                    {velocityReport?.completedTasks && velocityReport.completedTasks.length > 0 ? (
                                        <div className="rounded-lg border border-border overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-muted/40">
                                                    <TableRow>
                                                        <TableHead className="font-semibold">Deliverable / Task</TableHead>
                                                        <TableHead className="font-semibold">Project</TableHead>
                                                        <TableHead className="font-semibold">Assignees</TableHead>
                                                        <TableHead className="font-semibold text-center">Story Points</TableHead>
                                                        <TableHead className="font-semibold text-center">AI QA Score</TableHead>
                                                        <TableHead className="font-semibold text-center">Turnaround</TableHead>
                                                        <TableHead className="font-semibold text-right">Completed On</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {velocityReport.completedTasks.map((t) => (
                                                        <TableRow key={t.id} className="hover:bg-muted/30">
                                                            <TableCell className="font-medium text-foreground max-w-[260px]">
                                                                <div className="line-clamp-1">{t.title}</div>
                                                                <span className="text-[10px] text-muted-foreground">{t.milestoneTitle}</span>
                                                            </TableCell>
                                                            <TableCell className="text-xs">
                                                                <Link
                                                                    href={`/dashboard/pm/${t.projectId}`}
                                                                    className="hover:text-primary transition-colors inline-flex items-center gap-1 font-medium text-foreground/90"
                                                                >
                                                                    {t.projectTitle}
                                                                    <ArrowUpRight className="w-3 h-3 opacity-60 print:hidden" />
                                                                </Link>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                {t.assignees.join(", ")}
                                                            </TableCell>
                                                            <TableCell className="text-center font-mono text-xs font-semibold text-purple-400">
                                                                {t.weight} Pts
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                {t.aiQualityScore !== null ? (
                                                                    <Badge variant="outline" className="text-xs font-mono border-purple-500/30 text-purple-400">
                                                                        {t.aiQualityScore}/100
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground">—</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                                                {t.turnaroundDays !== null ? `${t.turnaroundDays}d` : "—"}
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                                {t.completedAt.slice(0, 10)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground p-4 text-center border border-dashed border-border rounded-lg">
                                            No completed deliverables found for this period.
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
                    <p className="text-muted-foreground">Operations &amp; Project Management Lead</p>
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
