import { getAuditLogs, getSystemErrorLogs, getErrorSummaryMetrics } from "@/features/audit/actions";
import { AuditLogsTable } from "@/features/audit/components/AuditLogsTable";
import { ErrorLogsTable, SystemErrorLog } from "@/features/audit/components/ErrorLogsTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const unresolved = metricsRes.success ? metricsRes.metrics.unresolved : 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">Who did what, newest first. Entries cannot be edited or deleted.</p>
      </div>

      <Tabs defaultValue="audit" className="w-full space-y-4">
        <TabsList className="h-auto rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/60">
          <TabsTrigger value="audit" className="h-8 rounded-md px-3 text-sm font-medium data-[state=active]:bg-card data-[state=active]:ring-1 data-[state=active]:ring-border/70">
            Audit trail
          </TabsTrigger>
          <TabsTrigger value="errors" className="h-8 gap-1.5 rounded-md px-3 text-sm font-medium data-[state=active]:bg-card data-[state=active]:ring-1 data-[state=active]:ring-border/70">
            System errors
            {unresolved > 0 && (
              <span className="rounded-full bg-destructive px-1.5 text-xs font-semibold leading-5 tabular-nums text-destructive-foreground">{unresolved}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="m-0 space-y-4">
          {!auditRes.success ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Failed to load audit logs: {auditRes.message}</div>
          ) : (
            <AuditLogsTable
              initialData={{
                logs: auditRes.logs || [],
                pagination: auditRes.pagination || { page: 1, totalPages: 1, total: 0, limit: 20 },
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="errors" className="m-0 space-y-4">
          {!errorRes.success ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Failed to load error logs: {errorRes.message}</div>
          ) : (
            <ErrorLogsTable
              initialData={{
                logs: (errorRes.logs as SystemErrorLog[]) || [],
                pagination: errorRes.pagination || { page: 1, totalPages: 1, total: 0, limit: 20 },
              }}
              initialMetrics={metricsRes.success ? metricsRes.metrics : { total: 0, unresolved: 0, critical: 0, high: 0 }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
