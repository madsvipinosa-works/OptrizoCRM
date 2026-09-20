"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, ChevronDown, History } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FeedbackItem {
    id: string;
    status: string;
    commentText: string | null;
    createdAt: Date | string;
}

export function HistoricalFeedbackCollapsible({ feedback }: { feedback: FeedbackItem[] }) {
    const [isOpen, setIsOpen] = useState(false);

    if (!feedback || feedback.length === 0) return null;

    const latest = feedback[0];
    const historical = feedback.slice(1);

    return (
        <div className="mt-3 space-y-2 border-t border-border pt-2">
            {/* Display Latest Feedback */}
            <div className="bg-muted/30 p-2.5 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider font-mono ${latest.status === "APPROVED" ? "text-primary border-primary/30 bg-primary/10" : "text-destructive border-destructive/30 bg-destructive/10"}`}>
                        {latest.status.replace("_", " ")}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground font-mono">{new Date(latest.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {latest.commentText && (
                    <p className="text-xs text-foreground flex gap-1.5 items-start mt-1">
                        <MessageCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                        <span>{latest.commentText}</span>
                    </p>
                )}
            </div>

            {/* Collapsible toggle for older feedback iterations */}
            {historical.length > 0 && (
                <div>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 font-medium"
                    >
                        <History className="h-3.5 w-3.5 text-primary" />
                        <span>{isOpen ? "Hide previous iterations" : `Show ${historical.length} previous iteration${historical.length > 1 ? 's' : ''}`}</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                    </button>

                    <AnimatePresence>
                        {isOpen && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-2 overflow-hidden pl-2 border-l border-border mt-2"
                            >
                                {historical.map((fb, idx) => (
                                    <div key={fb.id || idx} className="bg-muted/20 p-2 rounded text-xs border border-border">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className={`text-[9px] font-mono ${fb.status === "APPROVED" ? "text-primary border-primary/20 bg-primary/5" : "text-destructive border-destructive/20 bg-destructive/5"}`}>
                                                {fb.status.replace("_", " ")}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground font-mono">{new Date(fb.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        {fb.commentText && (
                                            <p className="text-muted-foreground flex gap-1 items-start mt-0.5 text-[11px]">
                                                <span>{fb.commentText}</span>
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
