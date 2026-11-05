"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { uploadContentImage } from "@/features/cms/content/image-upload";

const MAX_BYTES = 2 * 1024 * 1024;

const UPLOAD_ERRORS: Record<string, string> = {
    FORBIDDEN: "You don't have permission to upload images.",
    FILE_REQUIRED: "Choose an image file.",
    FILE_TOO_LARGE: "The image must be 2 MB or smaller.",
    INVALID_FILE_TYPE: "Use a JPG or PNG image.",
    SERVER_ERROR: "The upload failed. Try again.",
};

type Props = {
    label: string;
    value: string[];
    onChange: (urls: string[]) => void;
    max: number;
    error?: string;
};

/** JPG or PNG, up to 2 MB each. Uploads go through `uploadContentImage` (content_editor only). */
export function ContentImageField({ label, value, onChange, max, error }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    async function handleFile(file: File | undefined) {
        if (!file) return;
        setUploadError(null);
        if (file.size > MAX_BYTES) {
            setUploadError(UPLOAD_ERRORS.FILE_TOO_LARGE);
            return;
        }
        if (file.type !== "image/jpeg" && file.type !== "image/png") {
            setUploadError(UPLOAD_ERRORS.INVALID_FILE_TYPE);
            return;
        }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const result = await uploadContentImage(formData);
            if (!result.ok) {
                setUploadError(UPLOAD_ERRORS[result.error] ?? UPLOAD_ERRORS.SERVER_ERROR);
                return;
            }
            // A single-image field replaces its image; a multi-image field appends.
            onChange(max === 1 ? [result.url] : [...value, result.url].slice(0, max));
        } catch {
            setUploadError(UPLOAD_ERRORS.SERVER_ERROR);
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    const canAdd = max === 1 || value.length < max;

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium">
                {label}
                {max > 1 && <span className="ml-2 text-xs font-normal text-muted-foreground">{value.length} / {max}</span>}
            </p>
            {value.length > 0 && (
                <ul className="flex flex-wrap gap-3">
                    {value.map((url, index) => (
                        <li key={`${url}-${index}`} className="space-y-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="h-20 w-28 rounded-md border border-border object-cover" />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onChange(value.filter((_, i) => i !== index))}
                            >
                                Remove
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
            {canAdd && (
                <div>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={(event) => void handleFile(event.target.files?.[0])}
                    />
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
                        {uploading ? "Uploading..." : max === 1 && value.length > 0 ? "Replace" : "+ Add"}
                    </Button>
                </div>
            )}
            <p className="text-xs text-muted-foreground">JPG or PNG, up to 2 MB</p>
            {(uploadError || error) && (
                <p role="alert" className="text-xs text-destructive">
                    {uploadError ?? error}
                </p>
            )}
        </div>
    );
}
