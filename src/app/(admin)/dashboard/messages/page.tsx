import { db } from "@/db";
import { messages } from "@/db/schema";
import { desc } from "drizzle-orm";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import { Mail, Clock } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
    // Fetch messages descending by creation date
    const messageList = await db.query.messages.findMany({
        orderBy: [desc(messages.createdAt)],
    });

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-glow">Inbox</h2>
                <p className="text-muted-foreground">
                    View inquiries from the contact form.
                </p>
            </div>

            <div className="grid gap-4">
                {messageList.length === 0 ? (
                    <div className="p-8 text-center border border-dashed rounded-lg text-muted-foreground">
                        No messages yet.
                    </div>
                ) : (
                    messageList.map((msg) => (
                        <Card key={msg.id} className="glass-card border-white/5 transition-all hover:bg-white/5">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            {msg.name}
                                            {!msg.read && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary text-black">
                                                    New
                                                </span>
                                            )}
                                        </CardTitle>
                                        <CardDescription className="flex items-center gap-1">
                                            <Mail className="h-3 w-3" /> {msg.email}
                                        </CardDescription>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {format(msg.createdAt, "MMM d, yyyy h:mm a")}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {msg.subject && (
                                    <p className="text-sm font-semibold mb-2 text-primary/80">
                                        Subject: {msg.subject}
                                    </p>
                                )}
                                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                                    {msg.message}
                                </p>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
