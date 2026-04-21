"use client";

import { FileUpload } from "@/components/ui/file-upload";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { addClientLeadDocument } from "@/features/client-portal/actions";

export function ClientDocumentUpload({ leadId }: { leadId: string }) {
    const router = useRouter();

    return (
        <div className="space-y-3">
            <FileUpload
                label="Upload a revision/supporting document"
                accept=".pdf,.zip,.png,.jpg,.jpeg,.webp"
                onChange={async (url) => {
                    if (!url) return;

                    const res = await addClientLeadDocument(leadId, url);
                    if (res.success) {
                        toast.success("Document uploaded successfully.");
                        router.refresh();
                    } else {
                        toast.error(res.message || "Upload failed");
                    }
                }}
            />
        </div>
    );
}

