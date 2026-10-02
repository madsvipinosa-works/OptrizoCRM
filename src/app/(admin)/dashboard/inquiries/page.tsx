import { db } from "@/db";
import { inquiries, inquiryStatusEnum, users } from "@/db/schema";
import { desc, like, eq, and, or, ne, inArray } from "drizzle-orm";
import { auth, hasRole } from "@/auth";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { InquiryManagementForm } from "@/features/inquiries/components/InquiryManagementForm";
import { InquiryDetailsDialog } from "@/features/inquiries/components/InquiryDetailsDialog";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export default async function InquiriesPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string;
        status?: string;
        tab?: string;
    }>;
}) {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "sales"])) {
        return <div className="p-8 text-center text-red-500">Unauthorized</div>;
    }

    const params = await searchParams;
    const query = params?.query || "";
    const status = params?.status || "";
    const selectedStatus = inquiryStatusEnum.enumValues.find((value) => value === status);
    const isHandledView = params?.tab === "handled";

    const workflowFilter = isHandledView
        ? or(eq(inquiries.isHandled, true), eq(inquiries.status, "Archived"))
        : and(eq(inquiries.isHandled, false), ne(inquiries.status, "Archived"));

    const whereClause = and(
        workflowFilter,
        selectedStatus ? eq(inquiries.status, selectedStatus) : undefined,
        query
            ? or(
                like(inquiries.name, `%${query}%`),
                like(inquiries.email, `%${query}%`),
                like(inquiries.subject, `%${query}%`)
            )
            : undefined
    );

    const inquiriesList = await db.query.inquiries.findMany({
        where: whereClause,
        orderBy: [desc(inquiries.createdAt)],
        with: {
            owner: { columns: { id: true, name: true } },
        }
    });

    const teamMembers = await db.query.users.findMany({
        where: and(inArray(users.role, ["superadmin", "sales"]), eq(users.isActive, true)),
        columns: {
            id: true,
            name: true,
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-glow">Inquiry Inbox</h2>
                    <p className="text-muted-foreground">
                        Open inquiries need follow-up. Handled and converted inquiries stay available in the second tab.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant={!isHandledView ? "default" : "outline"} size="sm">
                        <Link href="/dashboard/inquiries?tab=open">Open</Link>
                    </Button>
                    <Button asChild variant={isHandledView ? "default" : "outline"} size="sm">
                        <Link href="/dashboard/inquiries?tab=handled">Handled / converted</Link>
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border border-border glass-card overflow-hidden shadow-xs">
                <Table>
                    <TableHeader className="bg-muted/40">
                        <TableRow className="hover:bg-transparent border-border">
                            <TableHead className="w-[200px]">Name / Email</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>Next action</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead className="text-right">Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inquiriesList.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center p-8 text-muted-foreground">
                                    No inquiries found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            inquiriesList.map((inquiry) => (
                                <InquiryDetailsDialog
                                    key={inquiry.id}
                                    inquiryId={inquiry.id}
                                    isUnread={inquiry.status === "Unread"}
                                    description={`From ${inquiry.name} (${inquiry.email})`}
                                    trigger={
                                        <TableRow className="cursor-pointer hover:bg-muted/40 border-border transition-colors group">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">{inquiry.name}</span>
                                                    <span className="text-xs text-muted-foreground">{inquiry.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm font-medium text-foreground">{inquiry.subject || "No Subject"}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={inquiry.status === "Unread" ? "default" : "secondary"}>
                                                    {inquiry.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {inquiry.owner?.name || "Unassigned"}
                                            </TableCell>
                                            <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground" title={inquiry.nextAction || undefined}>
                                                {inquiry.nextAction || "No next action set"}
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-xs text-muted-foreground">{inquiry.source}</span>
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                {format(new Date(inquiry.createdAt), "MMM d, yyyy h:mm a")}
                                            </TableCell>
                                        </TableRow>
                                    }
                                >
                                    <div className="space-y-4 py-4">
                                        <div>
                                            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Subject</h4>
                                            <p className="text-base font-semibold text-foreground">{inquiry.subject || "No Subject"}</p>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Message</h4>
                                            <div className="bg-muted/40 p-4 rounded-lg border border-border text-sm text-foreground whitespace-pre-wrap">
                                                {inquiry.message}
                                            </div>
                                        </div>
                                        <div className="flex gap-4 pt-4 text-xs text-muted-foreground border-t border-border">
                                            <span>Status: {inquiry.status}</span>
                                            <span>Source: {inquiry.source}</span>
                                            <span>Sent: {format(new Date(inquiry.createdAt), "PPP")}</span>
                                        </div>
                                        <InquiryManagementForm
                                            inquiry={inquiry}
                                            teamMembers={teamMembers}
                                        />
                                    </div>
                                </InquiryDetailsDialog>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
