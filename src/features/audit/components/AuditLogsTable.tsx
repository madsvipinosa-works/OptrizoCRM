"use client";

import { useState, useEffect } from "react";
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

export function AuditLogsTable({ initialData }: { initialData: { logs: AuditLog[], pagination: any } }) {
    const [logs, setLogs] = useState<AuditLog[]>(initialData.logs);
    const [pagination, setPagination] = useState(initialData.pagination);
    const [loading, setLoading] = useState(false);

    const fetchLogs = async (page: number) => {
        setLoading(true);
        try {
            const { getAuditLogs } = await import("@/features/audit/actions");
            const res = await getAuditLogs(page);
            if (res.success) {
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
        <Card className="glass-card border-white/10 text-white mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <ShieldAlert className="h-5 w-5 text-red-400" /> System Audit Trail
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                        Immutable ledger of all system transactions and administrative actions.
                    </CardDescription>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => fetchLogs(pagination.page)}
                    disabled={loading}
                    className="border-white/10 hover:bg-white/10 hover:text-white"
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border border-white/10 overflow-hidden bg-black/40">
                    <Table>
                        <TableHeader className="bg-white/5 border-b border-white/10">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-gray-300">Timestamp</TableHead>
                                <TableHead className="text-gray-300">Actor</TableHead>
                                <TableHead className="text-gray-300">Action</TableHead>
                                <TableHead className="text-gray-300">Entity</TableHead>
                                <TableHead className="text-gray-300">Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                        {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                                    </TableCell>
                                    <TableCell className="font-medium text-sm whitespace-nowrap">
                                        {log.user ? (
                                            <div className="flex flex-col">
                                                <span>{log.user.name || "Unknown Admin"}</span>
                                                <span className="text-[10px] text-muted-foreground">{log.user.email}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground italic text-xs">System / Deleted User</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`text-[10px] ${actionColors[log.action] || actionColors.OTHER}`}>
                                            {log.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs font-semibold text-gray-300">
                                        {log.entity}
                                    </TableCell>
                                    <TableCell className="text-xs text-gray-400 max-w-[300px] truncate" title={log.details || ""}>
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
                            className="bg-black/50 border-white/10 hover:bg-white/10 h-8"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchLogs(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages || loading}
                            className="bg-black/50 border-white/10 hover:bg-white/10 h-8"
                        >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
