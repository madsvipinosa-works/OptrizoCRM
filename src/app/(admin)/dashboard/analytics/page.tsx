import { getAnalyticsData } from "@/features/crm/actions";
import { KPIStats } from "@/features/crm/components/KPIStats";
import { PipelineChart, SourceChart, TrendChart } from "@/features/crm/components/AnalyticsCharts";

export default async function AnalyticsPage() {
    const data = await getAnalyticsData();

    if (!data) {
        return (
            <div className="p-8 text-center">
                <p className="text-muted-foreground">Unable to load analytics data.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-white">Analytics</h1>
                <p className="text-sm text-muted-foreground">
                    Overview of your sales pipeline and performance.
                </p>
            </div>

            <KPIStats data={data.kpi} />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <PipelineChart data={data.charts.pipeline} />
                <SourceChart data={data.charts.sources} />
            </div>

            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
                <TrendChart data={data.charts.trend} />
            </div>
        </div>
    );
}
