import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { desc, like, eq, and, or } from "drizzle-orm";
import { Suspense } from "react";
import { auth } from "@/auth"; 
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ConvertInquiryButton } from "@/features/crm/components/ConvertInquiryButton";

export const dynamic = 'force-dynamic';

export default async function InquiriesPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string;
        status?: string;
    }>;
}) {
    const session = await auth();
    const isAdmin = session?.user?.role === "admin";
    const isEditor = session?.user?.role === "editor";

    if (!isAdmin && !isEditor) {
        return <div className="p-8 text-center text-red-500">Unauthorized</div>;
    }

    const params = await searchParams;
    const query = params?.query || "";
    const status = params?.status || "";

    const whereClause = and(
        status && status !== "all" ? eq(inquiries.status, status as any) : undefined,
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
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-glow">Inquiry Inbox</h2>
                    <p className="text-muted-foreground">
                        Manage generic contact form submissions and basic inquiries.
                    </p>
                </div>
            </div>

            <div className="rounded-md border border-white/10 bg-black/20 overflow-hidden">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="hover:bg-transparent border-white/10">
                            <TableHead className="w-[200px]">Name / Email</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead className="text-right">Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inquiriesList.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center p-8 text-muted-foreground">
                                    No inquiries found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            inquiriesList.map((inquiry) => (
                                <Dialog key={inquiry.id}>
                                    <DialogTrigger asChild>
                                        <TableRow className="cursor-pointer hover:bg-white/5 border-white/10 transition-colors group">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-white group-hover:text-primary transition-colors">{inquiry.name}</span>
                                                    <span className="text-xs text-muted-foreground">{inquiry.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm font-medium">{inquiry.subject || "No Subject"}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={inquiry.status === "Unread" ? "default" : "secondary"}>
                                                    {inquiry.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-xs text-muted-foreground">{inquiry.source}</span>
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                {format(new Date(inquiry.createdAt), "MMM d, yyyy h:mm a")}
                                            </TableCell>
                                        </TableRow>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl bg-black/90 border-white/10 text-white">
                                        <DialogHeader>
                                            <DialogTitle>Inquiry Details</DialogTitle>
                                            <DialogDescription>
                                                From {inquiry.name} ({inquiry.email})
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div>
                                                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Subject</h4>
                                                <p className="text-base font-semibold">{inquiry.subject || "No Subject"}</p>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Message</h4>
                                                <div className="bg-white/5 p-4 rounded-md border border-white/10 text-sm whitespace-pre-wrap">
                                                    {inquiry.message}
                                                </div>
                                            </div>
                                            <div className="flex gap-4 pt-4 text-xs text-muted-foreground border-t border-white/10">
                                                <span>Status: {inquiry.status}</span>
                                                <span>Source: {inquiry.source}</span>
                                                <span>Sent: {format(new Date(inquiry.createdAt), "PPP")}</span>
                                            </div>
                                            {inquiry.status !== "Archived" && (
                                                <div className="pt-4 flex justify-end">
                                                    <ConvertInquiryButton inquiryId={inquiry.id} />
                                                </div>
                                            )}
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
