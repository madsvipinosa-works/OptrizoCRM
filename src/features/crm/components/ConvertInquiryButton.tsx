"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";
import { convertInquiryToLead } from "@/features/crm/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ConvertInquiryButton({ inquiryId, disabled }: { inquiryId: string, disabled?: boolean }) {
    const [isPending, setIsPending] = useState(false);
    const router = useRouter();

    const handleConvert = async () => {
        setIsPending(true);
        try {
            const res = await convertInquiryToLead(inquiryId);
            if (res.success) {
                toast.success(res.message);
                router.refresh();
            } else {
                toast.error(res.message || "Failed to convert inquiry.");
            }
        } catch (error) {
            toast.error("An unexpected error occurred.");
        } finally {
            setIsPending(false);
        }
    };

    return (
        <Button 
            onClick={handleConvert} 
            disabled={isPending || disabled}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
        >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Convert to Lead
        </Button>
    );
}
