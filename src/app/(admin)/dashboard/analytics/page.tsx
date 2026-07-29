import { getUnifiedDashboardData } from "@/features/crm/actions";
import { AnalyticsDashboard } from "@/features/crm/components/AnalyticsDashboard";

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
    const data = await getUnifiedDashboardData();

    if (!data) {
        return (
            <div className="p-12 text-center bg-black/40 border border-white/10 rounded-xl max-w-lg mx-auto my-12">
                <h3 className="text-lg font-semibold text-white mb-2">Unable to load telemetry</h3>
                <p className="text-sm text-zinc-400">
                    Ensure you are logged in with Admin or Editor credentials to access executive telemetry.
                </p>
            </div>
        );
    }

    return <AnalyticsDashboard data={data} />;
}
