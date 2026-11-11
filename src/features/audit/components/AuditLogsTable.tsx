"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { FilterX, RefreshCw } from "lucide-react";
import { DateRange } from "react-day-picker";

type AuditLog = {
    id: string;
    action: string;
    entity: string;
    details: string | null;
    createdAt: Date | string;
    user: {
        name: string | null;
        email: string | null;
        role: string | null;
    } | null;
};

// shortcut: hides raw record IDs at display time; upgrade when audit rows store record names instead.
const RECORD_ID = /\s*\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
function readableDetails(details: string | null) {
    if (!details) return "";
    return details.replace(RECORD_ID, "").replace(/\s+(by|to|for|from)\s*$/i, "").replace(/\s{2,}/g, " ").trim();
}

export function AuditLogsTable({ initialData }: { initialData: { logs: AuditLog[], pagination: { page: number, total: number, limit: number, totalPages: number } } }) {
    const [logs, setLogs] = useState<AuditLog[]>(initialData.logs);
    const [pagination, setPagination] = useState(initialData.pagination);
    const [loading, setLoading] = useState(false);

    // Filter states
    const [actionFilter, setActionFilter] = useState<string>("ALL");
    const [roleFilter, setRoleFilter] = useState<string>("ALL");
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    const fetchLogs = async (page: number, filters?: { action: string, role: string, date: DateRange | undefined }) => {
        setLoading(true);
        try {
            const currentFilters = filters || { action: actionFilter, role: roleFilter, date: dateRange };
            const { getAuditLogs } = await import("@/features/audit/actions");
            
            const payload = {
                action: currentFilters.action,
                role: currentFilters.role,
                startDate: currentFilters.date?.from?.toISOString(),
                endDate: currentFilters.date?.to?.toISOString(),
            };

            const res = await getAuditLogs(page, pagination.limit, payload);
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

    // When filters change, reset to page 1 and fetch
    useEffect(() => {
        // Skip initial render effect loop
        const timer = setTimeout(() => {
            fetchLogs(1, { action: actionFilter, role: roleFilter, date: dateRange });
        }, 300);
        return () => clearTimeout(timer);
    }, [actionFilter, roleFilter, dateRange]);

    const clearFilters = () => {
        setActionFilter("ALL");
        setRoleFilter("ALL");
        setDateRange(undefined);
    };

    const VERB: Record<string, string> = { CREATE: "Created", UPDATE: "Updated", DELETE: "Deleted", LOGIN: "Signed in", OTHER: "Activity" };
    const ROLE: Record<string, string> = {
        superadmin: "Super admin",
        sales: "Sales",
        manager: "Project manager",
        developer: "Developer",
        content_editor: "Content editor",
        client: "Client",
    };
    const filtered = actionFilter !== "ALL" || roleFilter !== "ALL" || dateRange !== undefined;
    const first = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
    const last = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
                <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger aria-label="Filter by action" className="h-10 w-full bg-card sm:w-[160px]" variant="plain">
                        <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All actions</SelectItem>
                        <SelectItem value="CREATE">Created</SelectItem>
                        <SelectItem value="UPDATE">Updated</SelectItem>
                        <SelectItem value="DELETE">Deleted</SelectItem>
                        <SelectItem value="LOGIN">Signed in</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger aria-label="Filter by role" className="h-10 w-full bg-card sm:w-[170px]" variant="plain">
                        <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All roles</SelectItem>
                        {Object.entries(ROLE).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-full sm:w-auto" />

                {filtered && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                        <FilterX className="mr-1 size-4" aria-hidden="true" /> Clear
                    </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => fetchLogs(pagination.page)} disabled={loading} className="ml-auto h-10">
                    <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
                    Refresh
                </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
                            <TableHead className="h-11 pl-5 text-xs font-medium text-muted-foreground">When</TableHead>
                            <TableHead className="h-11 text-xs font-medium text-muted-foreground">Who</TableHead>
                            <TableHead className="h-11 text-xs font-medium text-muted-foreground">Action</TableHead>
                            <TableHead className="hidden h-11 pr-5 text-xs font-medium text-muted-foreground md:table-cell">Details</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.map((log) => (
                            <TableRow key={log.id} className="border-border">
                                <TableCell className="whitespace-nowrap py-3 pl-5 text-sm tabular-nums text-muted-foreground">
                                    <time dateTime={new Date(log.createdAt).toISOString()}>{format(new Date(log.createdAt), "MMM d, h:mm a")}</time>
                                </TableCell>
                                <TableCell className="whitespace-nowrap py-3 text-sm text-foreground">
                                    {log.user ? (
                                        <>
                                            {log.user.name || "Unknown"}
                                            {log.user.role && <span className="text-muted-foreground"> · {ROLE[log.user.role] ?? log.user.role}</span>}
                                        </>
                                    ) : (
                                        <span className="text-muted-foreground">System · automatic</span>
                                    )}
                                </TableCell>
                                <TableCell className="py-3 text-sm">
                                    <span className={log.action === "DELETE" ? "font-semibold text-destructive" : "font-semibold text-foreground"}>{VERB[log.action] ?? "Activity"}</span>
                                    <span className="text-muted-foreground"> · {log.entity}</span>
                                </TableCell>
                                <TableCell className="hidden max-w-[520px] whitespace-normal break-words py-3 pr-5 text-sm text-muted-foreground md:table-cell">
                                    {readableDetails(log.details) || "–"}
                                </TableCell>
                            </TableRow>
                        ))}
                        {logs.length === 0 && (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={4} className="px-5 py-14 text-center">
                                    <p className="text-sm font-medium text-foreground">{filtered ? "No entries match these filters." : "Nothing has been recorded yet."}</p>
                                    {filtered && <p className="mt-1 text-sm text-muted-foreground">Clear the filters to see everything.</p>}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                    <p className="text-sm text-muted-foreground">
                        {first}–{last} of {pagination.total} entries
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => fetchLogs(pagination.page - 1)} disabled={pagination.page <= 1 || loading}>
                            Previous
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => fetchLogs(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages || loading}>
                            Next
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
