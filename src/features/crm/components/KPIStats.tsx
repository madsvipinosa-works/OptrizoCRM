import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Trophy, TrendingUp, DollarSign, Clock, AlertTriangle, Activity, LineChart, Target, Zap } from "lucide-react";

interface KPIStatsProps {
    data: {
        totalLeads: number;
        wonLeads: number;
        conversionRate: string;
        pipelineValue: string;
        avgLeadAgeDays?: string;
        staleLeadsCount?: number;
        responseRate?: string;
        clv?: string;
        romi?: number;
        adminHoursSaved?: number;
    };
}

export function KPIStats({ data }: KPIStatsProps) {
    return (
        <div className="space-y-4">
            {/* Primary Business KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="glass-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Leads
                        </CardTitle>
                        <Users className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-foreground">{data.totalLeads}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            All time
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Won Deals
                        </CardTitle>
                        <Trophy className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-foreground">{data.wonLeads}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Closed successfully
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Conversion Rate
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-foreground">{data.conversionRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Leads to Won
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Pipeline Value
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-foreground">${data.pipelineValue}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Est. Active Revenue
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Active Lead Management KPIs */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="glass-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-500 dark:text-blue-400">
                            Avg Lead Aging
                        </CardTitle>
                        <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-foreground">{data.avgLeadAgeDays || "0"} <span className="text-sm font-normal text-muted-foreground font-sans">days</span></div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Average time leads sit as &quot;New&quot;
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-rose-500 dark:text-rose-400">
                            Stale Leads
                        </CardTitle>
                        <AlertTriangle className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-foreground">{data.staleLeadsCount || "0"}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Active leads untouched &gt; 2 days
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-500 dark:text-emerald-400">
                            Response Rate
                        </CardTitle>
                        <Activity className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-foreground">{data.responseRate || "0"}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Percentage of leads actioned
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Advanced Intelligence & ROI */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="glass-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-500 dark:text-emerald-400">
                            Avg. Customer Lifetime Value
                        </CardTitle>
                        <Target className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-foreground">${data.clv || "0"}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Average pipeline value per won client
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-purple-500 dark:text-purple-400">
                            Return on Marketing (ROMI)
                        </CardTitle>
                        <LineChart className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-foreground">{data.romi || "0"}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Calculated against $1,000 monthly spend
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-amber-500 dark:text-amber-400">
                            Admin Hours Saved
                        </CardTitle>
                        <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-foreground">{data.adminHoursSaved || "0"} <span className="text-sm font-normal text-muted-foreground font-sans">hours</span></div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Automated scaffolding & comms via PM Engine
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
