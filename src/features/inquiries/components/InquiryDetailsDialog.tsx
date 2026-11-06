"use client";

import { cloneElement, isValidElement, useState, useTransition, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
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
            {/* A table row is not focusable by default: give it a tab stop and Enter / Space. */}
            <DialogTrigger asChild>
                {isValidElement(trigger)
                    ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
                          tabIndex: 0,
                          onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                              if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  event.currentTarget.click();
                              }
                          },
                      })
                    : trigger}
            </DialogTrigger>
            <DialogContent className="max-w-2xl rounded-xl border-border bg-card text-foreground">
                <DialogHeader>
                    <DialogTitle className="text-foreground">Inquiry</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}
