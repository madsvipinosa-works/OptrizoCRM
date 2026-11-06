import { redirect } from "next/navigation";
import { auth, hasRole } from "@/auth";
import { BusinessAnalytics, SystemAnalytics } from "@/features/analytics/components/AnalyticsView";
import type { BusinessPeriod, SystemPeriod } from "@/features/analytics/queries";

export const dynamic = "force-dynamic";

const BUSINESS: BusinessPeriod[] = [1, 3, 6, 12];
const SYSTEM: SystemPeriod[] = [7, 30, 90];

/** Super Admin analytics (mockups 108 and 109): Business and System tabs, read-only counts and rates. */
export default async function AnalyticsPage({ searchParams }: { searchParams?: Promise<{ tab?: string; period?: string }> }) {
    const session = await auth();
    if (!hasRole(session, ["superadmin"])) redirect("/dashboard");

    const params = await searchParams;
    const period = Number(params?.period);

    if (params?.tab === "system") {
        return <SystemAnalytics days={SYSTEM.find((d) => d === period) ?? 30} />;
    }
    return <BusinessAnalytics months={BUSINESS.find((m) => m === period) ?? 6} />;
}
