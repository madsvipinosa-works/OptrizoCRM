import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Trophy, TrendingUp, DollarSign, Clock, AlertTriangle, Activity } from "lucide-react";

interface KPIStatsProps {
    data: {
        totalLeads: number;
        wonLeads: number;
        conversionRate: string;
        pipelineValue: string;
        avgLeadAgeDays?: string;
        staleLeadsCount?: number;
        responseRate?: string;
    };
}

export function KPIStats({ data }: KPIStatsProps) {
    return (
        <div className="space-y-4">
            {/* Primary Business KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="glass-card border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Leads
                        </CardTitle>
                        <Users className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{data.totalLeads}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            All time
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Won Deals
                        </CardTitle>
                        <Trophy className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{data.wonLeads}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Closed successfully
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Conversion Rate
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{data.conversionRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Leads to Won
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Pipeline Value
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">${data.pipelineValue}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Est. Active Revenue
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Active Lead Management KPIs */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="glass-card border-white/10 bg-gradient-to-br from-black to-blue-950/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-400">
                            Avg Lead Aging
                        </CardTitle>
                        <Clock className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{data.avgLeadAgeDays || "0"} <span className="text-sm font-normal text-muted-foreground">days</span></div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Average time leads sit as &quot;New&quot;
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10 bg-gradient-to-br from-black to-red-950/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-400">
                            Stale Leads
                        </CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{data.staleLeadsCount || "0"}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Active leads untouched &gt; 2 days
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10 bg-gradient-to-br from-black to-green-950/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-400">
                            Response Rate
                        </CardTitle>
                        <Activity className="h-4 w-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{data.responseRate || "0"}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Percentage of leads actioned
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
