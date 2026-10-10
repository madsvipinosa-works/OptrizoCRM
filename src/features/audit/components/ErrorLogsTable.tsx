"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilterX,
  RefreshCw,
  Search,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { DateRange } from "react-day-picker";
import {
  getSystemErrorLogs,
  resolveSystemError,
  reopenSystemError,
  getErrorSummaryMetrics,
} from "@/features/audit/actions";

export type SystemErrorLog = {
  id: string;
  errorCode: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  stackTrace: string | null;
  source: string;
  context: Record<string, unknown> | null;
  isResolved: boolean;
  resolvedAt: Date | string | null;
  resolutionNotes: string | null;
  createdAt: Date | string;
  user: {
    name: string | null;
    email: string | null;
    role: string | null;
  } | null;
  resolvedBy: {
    name: string | null;
    email: string | null;
  } | null;
};

type ErrorLogsTableProps = {
  initialData: {
    logs: SystemErrorLog[];
    pagination: {
      page: number;
      total: number;
      limit: number;
      totalPages: number;
    };
  };
  initialMetrics?: {
    total: number;
    unresolved: number;
    critical: number;
    high: number;
  };
};

export function ErrorLogsTable({ initialData, initialMetrics }: ErrorLogsTableProps) {
  const [logs, setLogs] = useState<SystemErrorLog[]>(initialData.logs);
  const [pagination, setPagination] = useState(initialData.pagination);
  const [metrics, setMetrics] = useState(
    initialMetrics || { total: 0, unresolved: 0, critical: 0, high: 0 }
  );
  const [loading, setLoading] = useState(false);

  // Filter states
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Inspector Modal state
  const [selectedLog, setSelectedLog] = useState<SystemErrorLog | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);

  // Resolution Modal state
  const [resolvingLog, setResolvingLog] = useState<SystemErrorLog | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  const fetchLogs = async (page: number) => {
    setLoading(true);
    try {
      const res = await getSystemErrorLogs(page, pagination.limit, {
        severity: severityFilter,
        status: statusFilter,
        search: searchQuery,
        startDate: dateRange?.from?.toISOString(),
        endDate: dateRange?.to?.toISOString(),
      });

      if (res.success && res.logs && res.pagination) {
        setLogs(res.logs as SystemErrorLog[]);
        setPagination(res.pagination);
      }

      // Also refresh summary metrics
      const metricsRes = await getErrorSummaryMetrics();
      if (metricsRes.success && metricsRes.metrics) {
        setMetrics(metricsRes.metrics);
      }
    } catch (err) {
      console.error("Failed to fetch system error logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [severityFilter, statusFilter, searchQuery, dateRange]);

  const clearFilters = () => {
    setSeverityFilter("ALL");
    setStatusFilter("ALL");
    setSearchQuery("");
    setDateRange(undefined);
  };

  const handleOpenResolve = (log: SystemErrorLog) => {
    setResolvingLog(log);
    setResolutionNotes("");
  };

  const handleConfirmResolve = async () => {
    if (!resolvingLog) return;
    setIsSubmittingResolution(true);
    try {
      const res = await resolveSystemError(resolvingLog.id, resolutionNotes);
      if (res.success) {
        setResolvingLog(null);
        await fetchLogs(pagination.page);
      }
    } catch (err) {
      console.error("Failed to resolve error:", err);
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  const handleReopen = async (logId: string) => {
    try {
      const res = await reopenSystemError(logId);
      if (res.success) {
        await fetchLogs(pagination.page);
      }
    } catch (err) {
      console.error("Failed to reopen error:", err);
    }
  };

  const severityStyles: Record<string, string> = {
    CRITICAL: "bg-red-500/15 text-red-500 border-red-500/30",
    HIGH: "bg-orange-500/15 text-orange-500 border-orange-500/30",
    MEDIUM: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
    LOW: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card border-border p-4">
          <p className="text-xs uppercase font-mono text-muted-foreground">Total Errors</p>
          <p className="text-2xl font-bold text-foreground mt-1">{metrics.total}</p>
        </Card>
        <Card className="glass-card border-border p-4">
          <p className="text-xs uppercase font-mono text-muted-foreground">Unresolved</p>
          <p className="text-2xl font-bold text-amber-500 mt-1">{metrics.unresolved}</p>
        </Card>
        <Card className="glass-card border-border p-4">
          <p className="text-xs uppercase font-mono text-muted-foreground">Critical Unresolved</p>
          <p className="text-2xl font-bold text-destructive mt-1">{metrics.critical}</p>
        </Card>
        <Card className="glass-card border-border p-4">
          <p className="text-xs uppercase font-mono text-muted-foreground">High Unresolved</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{metrics.high}</p>
        </Card>
      </div>

      <Card className="glass-card border-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl text-foreground">
              <ShieldAlert className="h-5 w-5 text-destructive" /> System Error Diagnostics & Logs
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Real-time ledger of server exceptions, API errors, and runtime failures for troubleshooting.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(pagination.page)}
            disabled={loading}
            className="border-border hover:bg-muted text-foreground"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {/* Advanced Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-lg bg-muted/20 border border-border">
            {/* Search Input */}
            <div className="relative w-full sm:w-auto min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search code, message, or source..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border text-foreground"
              />
            </div>

            {/* Severity Filter */}
            <div className="w-full sm:w-auto">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full sm:w-[140px] bg-background border-border text-foreground">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="ALL">All Severities</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px] bg-background border-border text-foreground">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="UNRESOLVED">Unresolved</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Picker */}
            <div className="w-full sm:w-auto flex-1 max-w-[260px]">
              <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-full" />
            </div>

            {(severityFilter !== "ALL" ||
              statusFilter !== "ALL" ||
              searchQuery !== "" ||
              dateRange !== undefined) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <FilterX className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>

          {/* Table */}
          <div className="rounded-md border border-border overflow-hidden bg-card/60">
            <Table>
              <TableHeader className="bg-muted/40 border-b border-border">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-mono text-xs uppercase">Timestamp</TableHead>
                  <TableHead className="text-muted-foreground font-mono text-xs uppercase">Severity</TableHead>
                  <TableHead className="text-muted-foreground font-mono text-xs uppercase">Code</TableHead>
                  <TableHead className="text-muted-foreground font-mono text-xs uppercase">Message & Source</TableHead>
                  <TableHead className="text-muted-foreground font-mono text-xs uppercase">Status</TableHead>
                  <TableHead className="text-muted-foreground font-mono text-xs uppercase">Actor</TableHead>
                  <TableHead className="text-muted-foreground font-mono text-xs uppercase text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                      No system errors found matching the current criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                        {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono font-bold ${
                            severityStyles[log.severity] || severityStyles.MEDIUM
                          }`}
                        >
                          {log.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono font-semibold text-foreground whitespace-nowrap">
                        {log.errorCode}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-foreground font-medium truncate" title={log.message}>
                            {log.message}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate" title={log.source}>
                            src: {log.source}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.isResolved ? (
                          <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/20">
                            Resolved
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-red-500/10 text-destructive border-destructive/20">
                            Unresolved
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                        {log.user ? (
                          <div className="flex flex-col">
                            <span className="font-sans text-foreground">{log.user.name || log.user.email}</span>
                            <span className="text-[10px] text-muted-foreground">{log.user.role}</span>
                          </div>
                        ) : (
                          <span className="italic text-[11px]">System / Anonymous</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setSelectedLog(log);
                              setInspectOpen(true);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> Inspect
                          </Button>

                          {log.isResolved ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleReopen(log.id)}
                              title="Reopen issue"
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reopen
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs border-green-500/30 text-green-500 hover:bg-green-500/10"
                              onClick={() => handleOpenResolve(log)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted-foreground">
              Showing page {pagination.page} of {Math.max(1, pagination.totalPages)} ({pagination.total} total errors)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="h-8 border-border"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="h-8 border-border"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inspector Modal */}
      {selectedLog && (
        <Dialog open={inspectOpen} onOpenChange={setInspectOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Badge
                  variant="outline"
                  className={`${severityStyles[selectedLog.severity]} font-mono text-xs`}
                >
                  {selectedLog.severity}
                </Badge>
                <span className="font-mono">{selectedLog.errorCode}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Occurred on {format(new Date(selectedLog.createdAt), "MMMM d, yyyy HH:mm:ss")} • Source: {selectedLog.source}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div>
                <h4 className="text-xs font-semibold uppercase font-mono text-muted-foreground mb-1">Error Message</h4>
                <div className="p-3 bg-muted/30 rounded border border-border text-sm font-medium text-foreground">
                  {selectedLog.message}
                </div>
              </div>

              {selectedLog.stackTrace && (
                <div>
                  <h4 className="text-xs font-semibold uppercase font-mono text-muted-foreground mb-1">Stack Trace</h4>
                  <pre className="p-3 bg-black/70 rounded border border-border text-xs font-mono text-red-300 overflow-x-auto max-h-56">
                    {selectedLog.stackTrace}
                  </pre>
                </div>
              )}

              {selectedLog.context && Object.keys(selectedLog.context).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase font-mono text-muted-foreground mb-1">Contextual Metadata</h4>
                  <pre className="p-3 bg-black/70 rounded border border-border text-xs font-mono text-blue-300 overflow-x-auto max-h-40">
                    {JSON.stringify(selectedLog.context, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.isResolved && (
                <div className="p-3 rounded bg-green-500/10 border border-green-500/20 text-xs text-green-400 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Resolved by {selectedLog.resolvedBy?.name || selectedLog.resolvedBy?.email || "Admin"}
                    {selectedLog.resolvedAt && ` on ${format(new Date(selectedLog.resolvedAt), "MMM d, yyyy HH:mm")}`}
                  </div>
                  {selectedLog.resolutionNotes && (
                    <p className="text-muted-foreground">Notes: {selectedLog.resolutionNotes}</p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => setInspectOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Resolution Confirmation Modal */}
      {resolvingLog && (
        <Dialog open={!!resolvingLog} onOpenChange={(open) => !open && setResolvingLog(null)}>
          <DialogContent className="max-w-md bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" /> Resolve Issue
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Mark incident <span className="font-mono text-foreground">{resolvingLog.errorCode}</span> as resolved.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <label className="text-xs font-medium text-foreground">
                Resolution Notes (Optional)
              </label>
              <Textarea
                placeholder="e.g., Patched database timeout, updated API payload, or transient network spike resolved."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="bg-background border-border text-foreground text-xs"
                rows={3}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResolvingLog(null)}
                disabled={isSubmittingResolution}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-500 text-white"
                onClick={handleConfirmResolve}
                disabled={isSubmittingResolution}
              >
                {isSubmittingResolution ? "Saving..." : "Mark as Resolved"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
