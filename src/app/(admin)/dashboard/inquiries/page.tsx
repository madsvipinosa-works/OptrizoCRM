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
import { format } from "date-fns";
import { InquiryManagementForm } from "@/features/inquiries/components/InquiryManagementForm";
import { InquiryDetailsDialog } from "@/features/inquiries/components/InquiryDetailsDialog";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
    if (!hasRole(session, ["sales"])) {
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
        where: and(inArray(users.role, ["sales"]), eq(users.isActive, true)),
        columns: {
            id: true,
            name: true,
        }
    });

    const tabHref = (tab: "open" | "handled") => `/dashboard/inquiries?tab=${tab}`;

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inquiries</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Messages from the website contact form. Open ones need a reply; handled and converted ones are kept in the second tab.
                </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div role="group" aria-label="Inquiry list" className="inline-flex items-center rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/60">
                    {([
                        ["open", "Open", !isHandledView],
                        ["handled", "Handled / converted", isHandledView],
                    ] as const).map(([tab, label, active]) => (
                        <Link
                            key={tab}
                            href={tabHref(tab)}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "flex h-8 items-center rounded-md px-3 text-sm font-medium outline-none transition-[color,background-color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
                                active ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {label}
                        </Link>
                    ))}
                </div>

                <form action="/dashboard/inquiries" method="get" role="search" className="relative w-full sm:w-72">
                    <input type="hidden" name="tab" value={isHandledView ? "handled" : "open"} />
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                        type="search"
                        name="query"
                        defaultValue={query}
                        aria-label="Search name, email or subject"
                        placeholder="Search name, email or subject"
                        className="h-10 bg-card pl-9"
                    />
                </form>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="h-11 pl-5 text-xs font-medium text-muted-foreground">From</TableHead>
                            <TableHead className="h-11 text-xs font-medium text-muted-foreground">Subject</TableHead>
                            <TableHead className="h-11 text-xs font-medium text-muted-foreground">Status</TableHead>
                            <TableHead className="hidden h-11 text-xs font-medium text-muted-foreground md:table-cell">Owner</TableHead>
                            <TableHead className="hidden h-11 text-xs font-medium text-muted-foreground lg:table-cell">Next action</TableHead>
                            <TableHead className="h-11 pr-5 text-right text-xs font-medium text-muted-foreground">Received</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inquiriesList.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={6} className="px-5 py-14 text-center">
                                    <p className="text-sm font-medium text-foreground">
                                        {query ? "No inquiries match your search." : isHandledView ? "Nothing handled or converted yet." : "No open inquiries."}
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {query ? "Try a different name, email or subject." : "New messages from the website contact form show up here."}
                                    </p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            inquiriesList.map((inquiry) => {
                                const unread = inquiry.status === "Unread";
                                return (
                                    <InquiryDetailsDialog
                                        key={inquiry.id}
                                        inquiryId={inquiry.id}
                                        isUnread={unread}
                                        description={`From ${inquiry.name} (${inquiry.email})`}
                                        trigger={
                                            <TableRow className="group cursor-pointer border-border outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50">
                                                <TableCell className="py-3 pl-5">
                                                    <div className="flex flex-col">
                                                        <span className={cn("text-sm text-foreground", unread ? "font-semibold" : "font-medium")}>{inquiry.name}</span>
                                                        <span className="text-sm text-muted-foreground">{inquiry.email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[260px] truncate py-3 text-sm text-foreground">
                                                    {inquiry.subject || "No subject"}
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    <span
                                                        className={cn(
                                                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                                                            unread ? "bg-brand-soft text-brand-deep" : "bg-muted text-muted-foreground"
                                                        )}
                                                    >
                                                        {unread && <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-deep" />}
                                                        {inquiry.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="hidden py-3 text-sm text-muted-foreground md:table-cell">
                                                    {inquiry.owner?.name || "Unassigned"}
                                                </TableCell>
                                                <TableCell className="hidden max-w-[240px] truncate py-3 text-sm text-muted-foreground lg:table-cell" title={inquiry.nextAction || undefined}>
                                                    {inquiry.nextAction || "None set"}
                                                </TableCell>
                                                <TableCell className="py-3 pr-5 text-right text-sm tabular-nums text-muted-foreground">
                                                    <time dateTime={new Date(inquiry.createdAt).toISOString()} title={format(new Date(inquiry.createdAt), "PPP p")}>
                                                        {format(new Date(inquiry.createdAt), "MMM d, h:mm a")}
                                                    </time>
                                                </TableCell>
                                            </TableRow>
                                        }
                                    >
                                        <div className="space-y-4 py-2">
                                            <div>
                                                <h3 className="mb-1 text-sm font-medium text-muted-foreground">Subject</h3>
                                                <p className="text-base font-semibold text-foreground">{inquiry.subject || "No subject"}</p>
                                            </div>
                                            <div>
                                                <h3 className="mb-1 text-sm font-medium text-muted-foreground">Message</h3>
                                                <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
                                                    {inquiry.message}
                                                </div>
                                            </div>
                                            <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                                                {inquiry.status} · {inquiry.source || "Website form"} · Sent {format(new Date(inquiry.createdAt), "PPP")}
                                            </p>
                                            <InquiryManagementForm inquiry={inquiry} teamMembers={teamMembers} />
                                        </div>
                                    </InquiryDetailsDialog>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
