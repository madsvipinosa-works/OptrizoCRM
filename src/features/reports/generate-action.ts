"use server";

import { redirect } from "next/navigation";
import { auth, hasRole } from "@/auth";
import { logAction } from "@/features/audit/log";
import { COMPARE_OPTIONS, CUSTOM_PERIOD, customPeriod, isReportType, parsePeriod } from "./catalog";

/**
 * Generate report: checks the role on the server, writes one audit row (this is also what the
 * "Generated reports" list is built from) and opens the report. Nothing else is stored.
 */
export async function generateReport(formData: FormData) {
    const session = await auth();
    if (!hasRole(session, ["superadmin"])) redirect("/dashboard");

    const type = String(formData.get("type") ?? "");
    const compare = String(formData.get("compare") ?? "previous");

    // "Custom range" uses the From and To dates; anything else is a month or quarter from the list.
    const picked = String(formData.get("period") ?? "");
    const period =
        picked === CUSTOM_PERIOD ? customPeriod(String(formData.get("from") ?? ""), String(formData.get("to") ?? ""))?.value ?? "" : picked;

    if (!isReportType(type)) redirect("/dashboard/reports");
    if (!parsePeriod(period)) redirect(`/dashboard/reports?problem=${picked === CUSTOM_PERIOD ? "range" : "period"}`);
    const mode = COMPARE_OPTIONS.some((o) => o.value === compare) ? compare : "previous";

    await logAction("CREATE", "Report", `type=${type};period=${period};compare=${mode}`);
    redirect(`/dashboard/reports/view?type=${type}&period=${encodeURIComponent(period)}&compare=${mode}`);
}
