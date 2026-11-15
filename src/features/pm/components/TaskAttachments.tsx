"use client";

import { useRef, useState } from "react";
import { FileText, Link2, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadImage } from "@/features/upload/actions";
import { MAX_ATTACHMENTS } from "@/features/pm/task-attachments";
import { normalizeProofUrl } from "@/lib/proof-url";
import type { TaskAttachment } from "@/db/schema";

const ACCEPT = ".pdf,.doc,.docx,.zip,.png,.jpg,.jpeg,.webp,.gif,.svg";

/** Read-only list: each file or link opens in a new tab. */
export function AttachmentList({ items }: { items: TaskAttachment[] }) {
    if (items.length === 0) return null;
    return (
        <ul className="space-y-2">
            {items.map((a, i) => (
                <li key={`${a.url}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                        {a.kind === "file" ? (
                            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        ) : (
                            <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        )}
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{a.label}</p>
                            <p className="text-xs text-muted-foreground">{a.kind === "file" ? "File" : "Link"}</p>
                        </div>
                    </div>
                    <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-md px-2 py-1.5 text-sm font-semibold text-brand-deep underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        Open<span className="sr-only"> {a.label}</span>
                    </a>
                </li>
            ))}
        </ul>
    );
}

/** Files are uploaded for this project; links need a label and a full address. */
export function AttachmentEditor({
    value,
    onChange,
    projectId,
    disabled,
}: {
    value: TaskAttachment[];
    onChange: (next: TaskAttachment[]) => void;
    projectId: string;
    disabled?: boolean;
}) {
    const fileInput = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [addingLink, setAddingLink] = useState(false);
    const [linkLabel, setLinkLabel] = useState("");
    const [linkUrl, setLinkUrl] = useState("");
    const full = value.length >= MAX_ATTACHMENTS;

    const upload = async (file: File) => {
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId);
        const res = await uploadImage(formData);
        setUploading(false);
        if (res.success && res.url) {
            onChange([...value, { kind: "file", label: file.name, url: res.url }]);
        } else {
            toast.error(res.message || "Upload failed");
        }
    };

    const addLink = () => {
        const url = normalizeProofUrl(linkUrl);
        if (!url) {
            toast.error("Use a full link, such as https://example.com");
            return;
        }
        onChange([...value, { kind: "link", label: linkLabel.trim() || url, url }]);
        setLinkLabel("");
        setLinkUrl("");
        setAddingLink(false);
    };

    return (
        <div className="space-y-3">
            {value.length > 0 && (
                <ul className="space-y-2">
                    {value.map((a, i) => (
                        <li key={`${a.url}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                                {a.kind === "file" ? (
                                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                ) : (
                                    <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                )}
                                <span className="truncate text-sm text-foreground">{a.label}</span>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={disabled}
                                onClick={() => onChange(value.filter((_, j) => j !== i))}
                                className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                                <X className="size-3.5" aria-hidden="true" />
                                <span className="sr-only">Remove {a.label}</span>
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <input
                    ref={fileInput}
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void upload(file);
                    }}
                />
                <Button type="button" variant="outline" size="sm" disabled={disabled || uploading || full} onClick={() => fileInput.current?.click()} className="h-8 gap-1.5 bg-card">
                    {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Paperclip className="size-3.5" aria-hidden="true" />}
                    {uploading ? "Uploading…" : "Upload file"}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={disabled || full} onClick={() => setAddingLink((v) => !v)} className="h-8 gap-1.5 bg-card">
                    <Link2 className="size-3.5" aria-hidden="true" />
                    Add link
                </Button>
                <span className="text-xs text-muted-foreground">PDF, Word, ZIP or images, up to 15 MB each</span>
            </div>

            {addingLink && (
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label (e.g. Figma)" aria-label="Link label" className="h-9 bg-card sm:w-40" maxLength={120} />
                    <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." aria-label="Link address" className="h-9 flex-1 bg-card" />
                    <Button type="button" size="sm" onClick={addLink} disabled={!linkUrl.trim()} className="h-9">
                        Add
                    </Button>
                </div>
            )}
            {full && <p className="text-xs text-muted-foreground">You can attach up to {MAX_ATTACHMENTS} files or links.</p>}
        </div>
    );
}
