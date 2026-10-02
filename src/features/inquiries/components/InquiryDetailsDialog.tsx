"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { markInquiryRead } from "@/features/inquiries/actions";
import { toast } from "sonner";

interface InquiryDetailsDialogProps {
    inquiryId: string;
    isUnread: boolean;
    trigger: ReactNode;
    children: ReactNode;
    description: ReactNode;
}

export function InquiryDetailsDialog({
    inquiryId,
    isUnread,
    trigger,
    children,
    description,
}: InquiryDetailsDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        if (!nextOpen || !isUnread || isPending) return;

        startTransition(async () => {
            const result = await markInquiryRead(inquiryId);
            if (!result.success) {
                toast.error(result.message || "Failed to mark inquiry as read");
                return;
            }
            router.refresh();
        });
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-w-2xl bg-card border-border text-foreground shadow-2xl rounded-xl">
                <DialogHeader>
                    <DialogTitle className="text-foreground">Inquiry Details</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}
