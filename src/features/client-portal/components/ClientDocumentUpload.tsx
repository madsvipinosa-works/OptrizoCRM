"use client";

import { FileUpload } from "@/components/ui/file-upload";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { addClientLeadDocument } from "@/features/client-portal/actions";

interface ClientDocumentUploadProps {
    leadId?: string | null;
    projectId?: string;
}

export function ClientDocumentUpload({ leadId, projectId }: ClientDocumentUploadProps) {
    const router = useRouter();

    return (
        <div className="space-y-3">
            <FileUpload
                label="Upload a revision/supporting document"
                accept=".pdf,.zip,.png,.jpg,.jpeg,.webp,.doc,.docx,.xlsx"
                showSuccessToast={false}
                projectId={projectId}
                onChange={async (url) => {
                    if (!url) return;

                    const targetIdentifier = projectId || leadId || "";
                    const res = await addClientLeadDocument(targetIdentifier, url, projectId);
                    if (res.success) {
                        toast.success(res.message || "Document uploaded successfully.");
                        router.refresh();
                    } else {
                        toast.error(res.message || "Upload failed");
                    }
                }}
            />
        </div>
    );
}

