"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RefreshCw, ShieldAlert } from "lucide-react";

type AuditLog = {
    id: string;
    action: string;
    entity: string;
    details: string | null;
    createdAt: Date | string;
    user: {
        name: string | null;
        email: string | null;
    } | null;
};

export function AuditLogsTable({ initialData }: { initialData: { logs: AuditLog[], pagination: { page: number, total: number, limit: number, totalPages: number } } }) {
    const [logs, setLogs] = useState<AuditLog[]>(initialData.logs);
    const [pagination, setPagination] = useState(initialData.pagination);
    const [loading, setLoading] = useState(false);

    const fetchLogs = async (page: number) => {
        setLoading(true);
        try {
            const { getAuditLogs } = await import("@/features/audit/actions");
            const res = await getAuditLogs(page);
            if (res.success && res.pagination) {
                setLogs(res.logs as AuditLog[]);
                setPagination(res.pagination);
            }
        } catch (error) {
            console.error("Failed to fetch logs:", error);
        } finally {
            setLoading(false);
        }
    };

    const actionColors: Record<string, string> = {
        CREATE: "bg-green-500/10 text-green-500 border-green-500/20",
        UPDATE: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        DELETE: "bg-red-500/10 text-red-500 border-red-500/20",
        LOGIN: "bg-purple-500/10 text-purple-500 border-purple-500/20",
        OTHER: "bg-gray-500/10 text-gray-500 border-gray-500/20"
    };

    return (
        <Card className="glass-card border-border mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2 text-xl text-foreground">
                        <ShieldAlert className="h-5 w-5 text-destructive" /> System Audit Trail
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Immutable ledger of all system transactions and administrative actions.
                    </CardDescription>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => fetchLogs(pagination.page)}
                    disabled={loading}
                    className="border-border hover:bg-muted text-foreground"
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border border-border overflow-hidden bg-card/60">
                    <Table>
                        <TableHeader className="bg-muted/40 border-b border-border">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-muted-foreground font-mono text-xs uppercase">Timestamp</TableHead>
                                <TableHead className="text-muted-foreground font-mono text-xs uppercase">Actor</TableHead>
                                <TableHead className="text-muted-foreground font-mono text-xs uppercase">Action</TableHead>
                                <TableHead className="text-muted-foreground font-mono text-xs uppercase">Entity</TableHead>
                                <TableHead className="text-muted-foreground font-mono text-xs uppercase">Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                                        {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                                    </TableCell>
                                    <TableCell className="font-medium text-sm whitespace-nowrap text-foreground">
                                        {log.user ? (
                                            <div className="flex flex-col">
                                                <span>{log.user.name || "Unknown Admin"}</span>
                                                <span className="text-[10px] text-muted-foreground font-mono">{log.user.email}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground italic text-xs">System / Deleted User</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`text-[10px] font-mono ${actionColors[log.action] || actionColors.OTHER}`}>
                                            {log.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs font-semibold text-foreground font-mono">
                                        {log.entity}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate" title={log.details || ""}>
                                        {log.details || "-"}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {logs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No audit records found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between mt-4">
                    <div className="text-xs text-muted-foreground">
                        Showing page {pagination.page} of {pagination.totalPages || 1} ({pagination.total} total records)
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchLogs(pagination.page - 1)}
                            disabled={pagination.page <= 1 || loading}
                            className="border-border hover:bg-muted text-foreground h-8"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchLogs(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages || loading}
                            className="border-border hover:bg-muted text-foreground h-8"
                        >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
