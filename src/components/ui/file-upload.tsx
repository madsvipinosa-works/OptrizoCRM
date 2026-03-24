import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Loader2, FileUp, FileText } from "lucide-react";
import { uploadImage } from "@/features/upload/actions"; // works for all files
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FileUploadProps {
    value?: string | null;
    onChange: (url: string) => void;
    label?: string;
    accept?: string;
}

export function FileUpload({ value, onChange, label = "Upload File", accept = ".pdf,.doc,.docx" }: FileUploadProps) {
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        const result = await uploadImage(formData);

        if (result.success && result.url) {
            onChange(result.url);
            toast.success("File uploaded successfully!");
        } else {
            toast.error(result.message || "Upload failed");
        }
        setIsUploading(false);
    };

    const handleRemove = () => {
        onChange("");
    };

    return (
        <div className="space-y-2">
            <Label>{label}</Label>

            {value ? (
                <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5 group">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-10 w-10 shrink-0 bg-primary/10 flex items-center justify-center rounded-md">
                            <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="truncate">
                            <a href={value} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline text-white truncate inline-block max-w-[200px]">
                                {value.split('/').pop() || "Document"}
                            </a>
                            <p className="text-[10px] text-muted-foreground uppercase">Uploaded File</p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-red-500"
                        onClick={handleRemove}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {isUploading ? (
                                <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-2" />
                            ) : (
                                <FileUp className="h-8 w-8 text-muted-foreground mb-2" />
                            )}
                            <p className="mb-1 text-sm text-muted-foreground">
                                <span className="font-semibold">Click to upload Document</span>
                            </p>
                            <p className="text-xs text-muted-foreground">PDFs allowed (MAX. 5MB)</p>
                        </div>
                        <Input
                            type="file"
                            className="hidden"
                            accept={accept}
                            onChange={handleFileChange}
                            disabled={isUploading}
                        />
                    </label>
                </div>
            )}
        </div>
    );
}
