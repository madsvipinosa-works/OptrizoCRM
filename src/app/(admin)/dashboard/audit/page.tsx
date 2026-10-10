import { getAuditLogs, getSystemErrorLogs, getErrorSummaryMetrics } from "@/features/audit/actions";
import { AuditLogsTable } from "@/features/audit/components/AuditLogsTable";
import { ErrorLogsTable, SystemErrorLog } from "@/features/audit/components/ErrorLogsTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Bug } from "lucide-react";
import { auth, hasRole } from "@/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Diagnostics & Audit Trail - Admin Dashboard",
};

export default async function AuditLogsPage() {
  const session = await auth();
  // Strictly restrict to superadmin role
  if (!hasRole(session, ["superadmin"])) {
    redirect("/dashboard");
  }

  const [auditRes, errorRes, metricsRes] = await Promise.all([
    getAuditLogs(1, 50),
    getSystemErrorLogs(1, 20),
    getErrorSummaryMetrics(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
          Security, Audit & Diagnostics
        </h1>
        <p className="text-muted-foreground">
          Monitor system transactions, review user activity audit trails, and inspect real-time application error logs.
        </p>
      </div>

      <Tabs defaultValue="audit" className="w-full space-y-6">
        <TabsList className="bg-muted/40 p-1 border border-border">
          <TabsTrigger value="audit" className="flex items-center gap-2 data-[state=active]:bg-card">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Audit Trail
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-2 data-[state=active]:bg-card">
            <Bug className="h-4 w-4 text-destructive" />
            System Errors & Diagnostics
            {metricsRes.success && metricsRes.metrics.unresolved > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-destructive text-destructive-foreground font-mono font-bold">
                {metricsRes.metrics.unresolved}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4 m-0">
          {!auditRes.success ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-md">
              Failed to load audit logs: {auditRes.message}
            </div>
          ) : (
            <AuditLogsTable
              initialData={{
                logs: auditRes.logs || [],
                pagination: auditRes.pagination || { page: 1, totalPages: 1, total: 0, limit: 20 },
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="errors" className="space-y-4 m-0">
          {!errorRes.success ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-md">
              Failed to load error logs: {errorRes.message}
            </div>
          ) : (
            <ErrorLogsTable
              initialData={{
                logs: (errorRes.logs as SystemErrorLog[]) || [],
                pagination: errorRes.pagination || { page: 1, totalPages: 1, total: 0, limit: 20 },
              }}
              initialMetrics={
                metricsRes.success
                  ? metricsRes.metrics
                  : { total: 0, unresolved: 0, critical: 0, high: 0 }
              }
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
