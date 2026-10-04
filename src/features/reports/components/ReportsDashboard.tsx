"use client";

import { useState, useEffect } from "react";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { getLeadConversionReport, getTeamVelocityReport } from "@/features/reports/actions";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Printer } from "lucide-react";

export function ReportsDashboard({ hideHeader }: { hideHeader?: boolean }) {
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });

    const [leadReport, setLeadReport] = useState<any>(null);
    const [velocityReport, setVelocityReport] = useState<any>(null);
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
            const [leads, velocity] = await Promise.all([
                getLeadConversionReport(dateRange),
                getTeamVelocityReport(dateRange)
            ]);
            setLeadReport(leads);
            setVelocityReport(velocity);
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
        if (!leadReport || !velocityReport) return;
        
        let csv = "Report Type,Metric,Value\n";
        
        csv += `Lead Conversion,Total Cohort Leads,${leadReport.totalLeads}\n`;
        csv += `Lead Conversion,Won Leads,${leadReport.wonCount}\n`;
        csv += `Lead Conversion,Conversion Rate %,${leadReport.conversionRate.toFixed(2)}\n`;
        csv += `Lead Conversion,Avg Conversion Time (Days),${leadReport.averageConversionTimeDays.toFixed(2)}\n`;
        csv += `Lead Conversion,Total Won Value,${leadReport.totalWonValue}\n`;
        
        csv += `Project Velocity,Total Completed Tasks,${velocityReport.totalCompletedTasks}\n`;
        csv += `Project Velocity,Total Story Points (Weight),${velocityReport.totalWeight}\n`;
        csv += `Project Velocity,Avg Turnaround Time (Days),${velocityReport.averageTurnaroundTimeDays.toFixed(2)}\n`;
        
        velocityReport.userVelocity.forEach((uv: any) => {
            csv += `User Velocity,${uv.name.replace(/,/g, '')} Tasks Completed,${uv.tasksCompleted}\n`;
            csv += `User Velocity,${uv.name.replace(/,/g, '')} Story Points,${uv.totalWeight}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', 'reports-export.csv');
        a.click();
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!hideHeader && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
                        <p className="text-muted-foreground mt-1">Generate and export performance reports.</p>
                    </div>
                </div>
            )}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-5">
                <div className="flex gap-2">
                    <Button onClick={handleExport} variant="default" size="sm" className="gap-2">
                        <Download className="w-4 h-4" /> Export CSV
                    </Button>
                    <Button onClick={handlePrint} variant="secondary" size="sm" className="gap-2">
                        <Printer className="w-4 h-4" /> Print
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
                <div className="h-64 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-6">
                    {/* Lead Conversion Report */}
                    <div className="glass-card border border-border rounded-xl p-6">
                        <h2 className="text-xl font-semibold mb-4 text-foreground">Lead Conversion Rate (Cohort)</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm text-muted-foreground">Total Cohort Leads</p>
                                <p className="text-3xl font-bold text-foreground">{leadReport?.totalLeads}</p>
                            </div>
                            <div className="p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm text-muted-foreground">Won Leads</p>
                                <p className="text-3xl font-bold text-green-500">{leadReport?.wonCount}</p>
                            </div>
                            <div className="p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                                <p className="text-3xl font-bold text-primary">{leadReport?.conversionRate.toFixed(1)}%</p>
                            </div>
                            <div className="p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm text-muted-foreground">Avg Conversion Time</p>
                                <p className="text-3xl font-bold text-foreground">{leadReport?.averageConversionTimeDays.toFixed(1)} days</p>
                            </div>
                        </div>
                    </div>

                    {/* Team Project Velocity Report */}
                    <div className="glass-card border border-border rounded-xl p-6">
                        <h2 className="text-xl font-semibold mb-4 text-foreground">Team Project Velocity</h2>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm text-muted-foreground">Tasks Completed</p>
                                <p className="text-3xl font-bold text-foreground">{velocityReport?.totalCompletedTasks}</p>
                            </div>
                            <div className="p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm text-muted-foreground">Total Story Points</p>
                                <p className="text-3xl font-bold text-blue-500">{velocityReport?.totalWeight}</p>
                            </div>
                            <div className="p-4 bg-muted/50 rounded-lg col-span-2">
                                <p className="text-sm text-muted-foreground">Avg Task Turnaround Time</p>
                                <p className="text-3xl font-bold text-foreground">{velocityReport?.averageTurnaroundTimeDays.toFixed(1)} days</p>
                            </div>
                        </div>

                        <h3 className="text-md font-semibold text-foreground mb-3">User Velocity Breakdown</h3>
                        {velocityReport?.userVelocity.length > 0 ? (
                            <div className="space-y-3">
                                {velocityReport.userVelocity.map((uv: any) => (
                                    <div key={uv.name} className="flex justify-between items-center p-3 border border-border rounded-lg bg-background/50">
                                        <span className="font-medium text-foreground">{uv.name}</span>
                                        <div className="text-right">
                                            <span className="text-sm font-semibold text-foreground">{uv.tasksCompleted} Tasks</span>
                                            <span className="text-xs text-muted-foreground block">{uv.totalWeight} Pts</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No tasks completed in this period.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
