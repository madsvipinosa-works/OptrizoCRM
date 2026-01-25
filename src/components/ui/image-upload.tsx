import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Loader2, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { uploadImage } from "@/features/upload/actions";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ImageUploadProps {
    value?: string | null;
    onChange: (url: string) => void;
    label?: string;
}

export function ImageUpload({ value, onChange, label = "Cover Image" }: ImageUploadProps) {
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
            toast.success("Image uploaded!");
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
                <div className="relative aspect-video w-full max-w-sm rounded-lg overflow-hidden border border-white/10 group">
                    <Image
                        src={value}
                        alt="Upload"
                        fill
                        className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={handleRemove}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center w-full max-w-sm">
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {isUploading ? (
                                <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-2" />
                            ) : (
                                <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                            )}
                            <p className="mb-2 text-sm text-muted-foreground">
                                <span className="font-semibold">Click to upload</span>
                            </p>
                            <p className="text-xs text-muted-foreground">PNG, JPG, WEBP (MAX. 5MB)</p>
                        </div>
                        <Input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                            disabled={isUploading}
                        />
                    </label>
                </div>
            )}

            {/* Hidden input to ensure value is submitted with form if needed, though usually handled by state in parent */}
            <input type="hidden" name="imageField" value={value || ""} />
        </div>
    );
}
