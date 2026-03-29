import { getAuditLogs } from "@/features/audit/actions";
import { AuditLogsTable } from "@/features/audit/components/AuditLogsTable";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Audit Trail - Admin Dashboard",
};

export default async function AuditLogsPage() {
    const session = await auth();
    // Double check authentication on page load; strictly restrict to fully admin role
    if (!session?.user || session.user.role !== "admin") {
        redirect("/dashboard");
    }

    const { success, logs, pagination, message } = await getAuditLogs(1, 50);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Security & Audit</h1>
                <p className="text-muted-foreground">
                    Review critical system events, entity modifications, and administrative actions.
                </p>
            </div>

            {!success ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-md">
                    Failed to load audit logs: {message}
                </div>
            ) : (
                <AuditLogsTable initialData={{ logs: logs || [], pagination: pagination || { page: 1, totalPages: 1, total: 0 } }} />
            )}
        </div>
    );
}
