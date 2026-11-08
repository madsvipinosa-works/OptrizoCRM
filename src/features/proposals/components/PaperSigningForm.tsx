"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { todayYmd } from "@/lib/datetime";
import { Label } from "@/components/ui/label";
import { FileUp, Calendar, Loader2, CheckCircle2 } from "lucide-react";
import { recordPaperSignature } from "@/features/proposals/signing";
import { uploadImage } from "@/features/upload/actions";
import { toast } from "sonner";

interface PaperSigningFormProps {
    proposalId: string;
    proposalStatus: string;
    proposalCode?: string | null;
    clientName?: string | null;
    onSuccess?: () => void;
}

export function PaperSigningForm({
    proposalId,
    proposalStatus,
    proposalCode,
    clientName,
    onSuccess,
}: PaperSigningFormProps) {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [signedDate, setSignedDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState("");

    // Only applicable if not already signed
    if (proposalStatus === "signed") {
        return (
            <Card className="border-brand-deep/30 bg-brand-soft">
                <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-brand-deep shrink-0" />
                    <div>
                        <p className="text-xs font-semibold text-foreground">Signed Proposal Agreement</p>
                        <p className="text-xs text-muted-foreground">This proposal has been officially executed and the project delivery pipeline initialized.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file && !uploadedUrl) {
            toast.error("Please select a signed paper agreement document");
            return;
        }

        setIsUploading(true);
        try {
            let finalUrl = uploadedUrl;
            if (file && !finalUrl) {
                const formData = new FormData();
                formData.append("file", file);
                const uploadRes = await uploadImage(formData);
                if (!uploadRes.success || !uploadRes.url) {
                    toast.error(uploadRes.message || "Failed to upload signed document");
                    setIsUploading(false);
                    return;
                }
                finalUrl = uploadRes.url;
                setUploadedUrl(finalUrl);
            }

            const res = await recordPaperSignature(proposalId, finalUrl, signedDate);
            if (res.success) {
                toast.success("Paper signature recorded! Project delivery initialized and Closed Won updated.");
                onSuccess?.();
                router.refresh();
            } else {
                toast.error(res.message || "Failed to record paper signature");
            }
        } catch (err: unknown) {
            console.error(err);
            toast.error("An error occurred while saving paper signature");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Card className="border-border bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileUp className="h-4 w-4 text-brand-deep" />
                    Record Paper Signature
                </CardTitle>
                <CardDescription className="text-xs">
                    Upload a scanned or photographed copy of the physically signed Statement of Work for {clientName || "Client"} ({proposalCode || "Proposal"}).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Signed Document (PDF or Image)</Label>
                            <Input
                                type="file"
                                accept=".pdf,image/*"
                                onChange={handleFileChange}
                                disabled={isUploading}
                                className="h-9 text-xs file:text-xs file:font-medium"
                                required={!uploadedUrl}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                Date of Physical Signature
                            </Label>
                            <DatePicker value={signedDate} onChange={setSignedDate} max={todayYmd()} disabled={isUploading} required className="h-9 text-xs" />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            type="submit"
                            size="sm"
                            disabled={isUploading || (!file && !uploadedUrl)}
                            className="text-xs font-semibold gap-1.5"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                    Recording Signature...
                                </>
                            ) : (
                                <>
                                    <FileUp className="h-3.5 w-3.5" />
                                    Save and mark signed
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
