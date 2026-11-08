"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FolderOpen, Plus, Trash2, FileText, FileCode2, Palette, Table, Link2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { updateProjectSettings, addProjectDocument, deleteProjectDocument } from "@/features/pm/actions";
import { type ProjectDocumentItem } from "@/db/schema";
import { cn } from "@/lib/utils";
import { FileUpload } from "@/components/ui/file-upload";

interface ProjectResourcesSidebarProps {
    project: {
        id: string;
        stagingUrls?: string[] | null;
        documents?: ProjectDocumentItem[] | null;
    };
}

const DOCUMENT_TYPES = [
    { value: "pdf", label: "PDF Document", icon: FileCode2, color: "text-destructive bg-destructive/10 border-destructive/30" },
    { value: "doc", label: "Word / Google Doc", icon: FileText, color: "text-stage-new bg-stage-new/10 border-stage-new/30" },
    { value: "figma", label: "Figma File", icon: Palette, color: "text-stage-proposal bg-stage-proposal/10 border-stage-proposal/30" },
    { value: "sheet", label: "Spreadsheet", icon: Table, color: "text-brand-deep bg-brand-soft border-brand-deep/30" },
    { value: "link", label: "General Link", icon: Link2, color: "text-stage-proposal bg-stage-proposal/10 border-stage-proposal/30" },
    { value: "zip", label: "ZIP Archive", icon: FolderOpen, color: "text-stage-negotiation bg-stage-negotiation/10 border-stage-negotiation/30" },
    { value: "image", label: "Image / Graphic", icon: Palette, color: "text-stage-discovery bg-stage-discovery/10 border-stage-discovery/30" },
] as const;

function formatFileSize(bytes?: number): string | null {
    if (!bytes || bytes <= 0) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ProjectResourcesSidebar({ project }: ProjectResourcesSidebarProps) {
    const [open, setOpen] = useState(false);
    const [stagingUrls, setStagingUrls] = useState<string[]>(project.stagingUrls || []);
    const [documents, setDocuments] = useState<ProjectDocumentItem[]>(project.documents || []);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"all" | "agency" | "client" | "staging">("all");

    // Add document state
    const [addMode, setAddMode] = useState<"link" | "upload">("link");
    const [newDocTitle, setNewDocTitle] = useState("");
    const [newDocUrl, setNewDocUrl] = useState("");
    const [newDocType, setNewDocType] = useState<"pdf" | "doc" | "figma" | "sheet" | "link" | "zip" | "image">("pdf");

    useEffect(() => {
        setStagingUrls(project.stagingUrls || []);
        setDocuments(project.documents || []);
    }, [project.stagingUrls, project.documents, open]);

    const clientDocuments = documents.filter(doc => doc.uploadedByRole === "client");
    const agencyDocuments = documents.filter(doc => doc.uploadedByRole !== "client");

    const handleAddDocumentLink = async () => {
        if (!newDocTitle.trim() || !newDocUrl.trim()) {
            toast.error("Please provide both title and URL.");
            return;
        }
        setIsSaving(true);
        const newDoc: ProjectDocumentItem = {
            id: crypto.randomUUID(),
            title: newDocTitle.trim(),
            url: newDocUrl.trim(),
            type: newDocType,
            sizeBytes: 0,
            uploadedById: "pm",
            uploadedByName: "Agency PM",
            uploadedByRole: "agency",
            createdAt: new Date().toISOString()
        };
        const res = await addProjectDocument(project.id, newDoc);
        if (res.success) {
            toast.success("Agency document added");
            setNewDocTitle("");
            setNewDocUrl("");
            setDocuments(prev => [...prev, newDoc]);
        } else {
            toast.error(res.message);
        }
        setIsSaving(false);
    };

    const handleRemoveDocument = async (id: string) => {
        if (!confirm("Are you sure you want to delete this document?")) return;
        setIsSaving(true);
        const res = await deleteProjectDocument(project.id, id);
        if (res.success) {
            toast.success("Document removed");
            setDocuments(prev => prev.filter(doc => doc.id !== id));
        } else {
            toast.error(res.message);
        }
        setIsSaving(false);
    };

    const handleSaveStagingUrls = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        const cleanUrls = stagingUrls.filter(u => u.trim() !== "");

        const res = await updateProjectSettings(project.id, cleanUrls);
        setIsSaving(false);

        if (res.success) {
            toast.success("Project settings saved!");
            setOpen(false);
        } else {
            toast.error(res.message || "Failed to save project settings.");
        }
    };

    const renderDocumentCard = (doc: ProjectDocumentItem, isClientDoc: boolean) => {
        const typeInfo = DOCUMENT_TYPES.find(t => t.value === doc.type) || DOCUMENT_TYPES[0];
        const IconComponent = typeInfo.icon;
        const sizeStr = formatFileSize(doc.sizeBytes);

        return (
            <li key={doc.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <IconComponent className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground" title={doc.title}>{doc.title}</p>
                    <p className="text-sm text-muted-foreground">
                        {[isClientDoc ? `From ${doc.uploadedByName || "the client"}` : `Added by ${doc.uploadedByName || "the PM"}`, doc.createdAt ? new Date(doc.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : null, sizeStr || null].filter(Boolean).join(" · ")}
                    </p>
                </div>
                <a
                    href={doc.url.startsWith("http") ? doc.url : `https://${doc.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-md text-sm font-semibold text-brand-deep outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                    Open
                </a>
                <button
                    type="button"
                    onClick={() => handleRemoveDocument(doc.id)}
                    aria-label={`Remove ${doc.title}`}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Trash2 className="size-4" aria-hidden="true" />
                </button>
            </li>
        );
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    aria-label="Files"
                    title="Files"
                    className="relative size-9 shrink-0 bg-card text-muted-foreground hover:text-foreground active:scale-[0.97]"
                >
                    <FolderOpen className="size-4 shrink-0" aria-hidden="true" />
                    {(documents.length > 0 || (stagingUrls && stagingUrls.length > 0)) && (
                        <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-brand-deep px-1 text-xs leading-4 tabular-nums text-white">
                            {documents.length + (stagingUrls?.filter(Boolean).length || 0)}
                        </span>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
                <SheetHeader className="shrink-0 space-y-3 px-6 pt-6 pb-4 text-left">
                    <div>
                        <SheetTitle className="text-xl font-semibold tracking-tight text-foreground">Files</SheetTitle>
                        <SheetDescription className="mt-1 text-sm text-muted-foreground">
                            Files from Optrizo, files from the client, and staging links for this project.
                        </SheetDescription>
                    </div>
                    <div role="group" aria-label="Show" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/60">
                            <button
                                type="button"
                                onClick={() => setActiveTab("all")}
                                aria-pressed={activeTab === "all"}
                                className={cn(
                                    "flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                                    activeTab === "all" ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                All <span className="tabular-nums text-muted-foreground">{stagingUrls.filter(Boolean).length + documents.length}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("agency")}
                                aria-pressed={activeTab === "agency"}
                                className={cn(
                                    "flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                                    activeTab === "agency" ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Optrizo <span className="tabular-nums text-muted-foreground">{agencyDocuments.length}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("client")}
                                aria-pressed={activeTab === "client"}
                                className={cn(
                                    "flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                                    activeTab === "client" ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Client <span className="tabular-nums text-muted-foreground">{clientDocuments.length}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("staging")}
                                aria-pressed={activeTab === "staging"}
                                className={cn(
                                    "flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                                    activeTab === "staging" ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Staging <span className="tabular-nums text-muted-foreground">{stagingUrls.filter(Boolean).length}</span>
                            </button>
                    </div>
                </SheetHeader>

                <form id="project-resources-form" onSubmit={handleSaveStagingUrls} className="flex-1 space-y-8 overflow-y-auto px-6 py-4">
                    {(activeTab === "all" || activeTab === "agency") && (
                        <section aria-labelledby="files-ours" className="space-y-3">
                            <div>
                                <h3 id="files-ours" className="text-base font-semibold text-foreground">From Optrizo</h3>
                                <p className="text-sm text-muted-foreground">Scope, designs and deliverables you share with the team and client.</p>
                            </div>
                            {agencyDocuments.length === 0 ? (
                                <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">No files yet. Add a link or upload one below.</p>
                            ) : (
                                <ul className="space-y-2">{agencyDocuments.map((doc) => renderDocumentCard(doc, false))}</ul>
                            )}

                            <div className="space-y-3 rounded-lg border border-border p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h4 className="text-sm font-semibold text-foreground">Add a file</h4>
                                    <div role="group" aria-label="How to add" className="inline-flex rounded-md bg-muted p-0.5 text-sm">
                                        {(["link", "upload"] as const).map((m) => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => setAddMode(m)}
                                                aria-pressed={addMode === m}
                                                className={cn(
                                                    "rounded px-2.5 py-1 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                    addMode === m ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                {m === "link" ? "Link" : "Upload"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {addMode === "link" ? (
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <Input
                                                aria-label="File name"
                                                className="h-10 flex-1 bg-card text-sm"
                                                value={newDocTitle}
                                                onChange={(e) => setNewDocTitle(e.target.value)}
                                                placeholder="Name, e.g. Scope of work"
                                            />
                                            <Select value={newDocType} onValueChange={(val: any) => setNewDocType(val)}>
                                                <SelectTrigger aria-label="File type" className="h-10 w-[130px] bg-card text-sm">
                                                    <SelectValue placeholder="Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {DOCUMENT_TYPES.map((t) => (
                                                        <SelectItem key={t.value} value={t.value} className="text-sm">
                                                            <span className="flex items-center gap-2">
                                                                <t.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                                                                {t.label}
                                                            </span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Input
                                            aria-label="Link"
                                            className="h-10 bg-card text-sm"
                                            value={newDocUrl}
                                            onChange={(e) => setNewDocUrl(e.target.value)}
                                            placeholder="https:// (Google Drive, Figma, ...)"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleAddDocumentLink}
                                            disabled={isSaving || !newDocTitle.trim() || !newDocUrl.trim()}
                                            className="h-10 w-full bg-card text-sm font-semibold active:scale-[0.97]"
                                        >
                                            <Plus className="mr-1.5 size-4" aria-hidden="true" /> Add link
                                        </Button>
                                    </div>
                                ) : (
                                        <div className="pt-1">
                                            <FileUpload
                                                label="Upload a file"
                                                accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.zip"
                                                showSuccessToast={false}
                                                projectId={project.id}
                                                onChange={async (url) => {
                                                    if (!url) return;
                                                    setIsSaving(true);
                                                    const fileName = url.split("/").pop() || "File";
                                                    const ext = fileName.split(".").pop()?.toLowerCase();
                                                    let docType: "pdf" | "doc" | "figma" | "sheet" | "link" | "zip" | "image" = "pdf";
                                                    if (ext === "doc" || ext === "docx") docType = "doc";
                                                    else if (ext === "xls" || ext === "xlsx" || ext === "csv") docType = "sheet";
                                                    else if (ext === "zip" || ext === "rar") docType = "zip";
                                                    else if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext || "")) docType = "image";

                                                    const newDoc: ProjectDocumentItem = {
                                                        id: crypto.randomUUID(),
                                                        title: fileName,
                                                        url,
                                                        type: docType,
                                                        sizeBytes: 0,
                                                        uploadedById: "pm",
                                                        uploadedByName: "the PM",
                                                        uploadedByRole: "agency",
                                                        createdAt: new Date().toISOString()
                                                    };
                                                    const res = await addProjectDocument(project.id, newDoc);
                                                    if (res.success) {
                                                        toast.success("File uploaded");
                                                        setDocuments(prev => [...prev, newDoc]);
                                                    } else {
                                                        toast.error(res.message);
                                                    }
                                                    setIsSaving(false);
                                                }}
                                            />
                                        </div>
                                )}
                            </div>
                        </section>
                    )}

                    {(activeTab === "all" || activeTab === "client") && (
                        <section aria-labelledby="files-client" className="space-y-3">
                            <div>
                                <h3 id="files-client" className="text-base font-semibold text-foreground">From the client</h3>
                                <p className="text-sm text-muted-foreground">Briefs and assets the client uploads in their portal appear here.</p>
                            </div>
                            {clientDocuments.length === 0 ? (
                                <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">The client hasn&apos;t uploaded anything yet.</p>
                            ) : (
                                <ul className="space-y-2">{clientDocuments.map((doc) => renderDocumentCard(doc, true))}</ul>
                            )}
                        </section>
                    )}

                    {(activeTab === "all" || activeTab === "staging") && (
                        <section aria-labelledby="files-staging" className="space-y-3">
                            <div>
                                <h3 id="files-staging" className="text-base font-semibold text-foreground">Staging links</h3>
                                <p className="text-sm text-muted-foreground">Preview sites the client can open to review the work.</p>
                            </div>
                            {stagingUrls.map((url, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <Input
                                        aria-label={`Staging link ${i + 1}`}
                                        className="h-10 flex-1 bg-card text-sm"
                                        value={url}
                                        onChange={(e) => {
                                            const next = [...stagingUrls];
                                            next[i] = e.target.value;
                                            setStagingUrls(next);
                                        }}
                                        placeholder="https://staging.example.com"
                                    />
                                    {url.trim() && (
                                        <a
                                            href={url.startsWith("http") ? url : `https://${url}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="shrink-0 rounded-md px-1.5 text-sm font-semibold text-brand-deep outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            Open
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setStagingUrls(stagingUrls.filter((_, idx) => idx !== i))}
                                        aria-label={`Remove staging link ${i + 1}`}
                                        className="shrink-0 rounded-md p-1.5 text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <Trash2 className="size-4" aria-hidden="true" />
                                    </button>
                                </div>
                            ))}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStagingUrls([...stagingUrls, ""])}
                                className="h-10 w-full bg-card text-sm font-medium active:scale-[0.97]"
                            >
                                <Plus className="mr-1.5 size-4" aria-hidden="true" /> Add a staging link
                            </Button>
                        </section>
                    )}
                </form>

                {/* Only staging links are saved here; files save as soon as they are added. */}
                {(activeTab === "all" || activeTab === "staging") && (
                    <div className="shrink-0 px-6 pt-2 pb-6">
                        <Button type="submit" form="project-resources-form" disabled={isSaving} className="h-11 w-full text-base font-semibold active:scale-[0.97]">
                            {isSaving ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : null}
                            Save staging links
                        </Button>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
