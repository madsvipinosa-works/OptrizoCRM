"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { 
    FolderOpen, 
    Plus, 
    Trash2, 
    ExternalLink, 
    Globe, 
    FileText, 
    FileCode2, 
    Palette, 
    Table, 
    Link2, 
    Sparkles, 
    UserCheck, 
    Briefcase, 
    UploadCloud,
    FileUp,
    Layers
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { updateProjectSettings, addProjectDocument, deleteProjectDocument } from "@/features/pm/actions";
import { type ProjectDocumentItem } from "@/db/schema";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/ui/file-upload";

interface ProjectResourcesSidebarProps {
    project: {
        id: string;
        stagingUrls?: string[] | null;
        documents?: ProjectDocumentItem[] | null;
    };
}

const DOCUMENT_TYPES = [
    { value: "pdf", label: "PDF Document", icon: FileCode2, color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
    { value: "doc", label: "Word / Google Doc", icon: FileText, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    { value: "figma", label: "Figma File", icon: Palette, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
    { value: "sheet", label: "Spreadsheet", icon: Table, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    { value: "link", label: "General Link", icon: Link2, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
    { value: "zip", label: "ZIP Archive", icon: FolderOpen, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    { value: "image", label: "Image / Graphic", icon: Palette, color: "text-teal-400 bg-teal-500/10 border-teal-500/20" },
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
            <div 
                key={doc.id} 
                className={cn(
                    "p-3.5 rounded-xl border transition-all space-y-2 shadow-xs group",
                    isClientDoc 
                        ? "border-sky-500/25 bg-sky-500/5 hover:border-sky-500/50" 
                        : "border-border bg-card hover:border-primary/40"
                )}
            >
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg border shrink-0", typeInfo.color)}>
                        <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground truncate" title={doc.title}>
                                {doc.title}
                            </span>
                            {isClientDoc ? (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded font-mono border-sky-500/40 text-sky-400 bg-sky-500/10 shrink-0">
                                    CLIENT
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded font-mono border-amber-500/40 text-amber-400 bg-amber-500/10 shrink-0">
                                    AGENCY
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                            {sizeStr && <span>{sizeStr}</span>}
                            {doc.createdAt && (
                                <>
                                    <span>•</span>
                                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                                </>
                            )}
                            {doc.uploadedByName && (
                                <>
                                    <span>•</span>
                                    <span className={isClientDoc ? "text-sky-300 font-medium" : "text-amber-300 font-medium"}>
                                        by {doc.uploadedByName}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                    
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        asChild
                        className="h-8 w-8 border-border bg-background hover:bg-muted text-foreground shrink-0"
                    >
                        <a href={doc.url.startsWith("http") ? doc.url : `https://${doc.url}`} target="_blank" rel="noreferrer" title="Open Document">
                            <ExternalLink className="h-3.5 w-3.5 text-primary" />
                        </a>
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveDocument(doc.id)}
                        className="h-8 w-8 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 shrink-0 rounded-lg"
                        title="Delete Document"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button 
                    variant="outline" 
                    className="border-border text-foreground hover:bg-muted transition-all shadow-xs"
                >
                    <FolderOpen className="h-4 w-4 mr-2 text-primary" />
                    Project Resources
                    {(documents.length > 0 || (stagingUrls && stagingUrls.length > 0)) && (
                        <span className="ml-2 px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20 font-mono">
                            {documents.length + (stagingUrls?.filter(Boolean).length || 0)}
                        </span>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent 
                side="right" 
                className="w-full sm:max-w-xl p-0 bg-card text-foreground border-l border-border backdrop-blur-2xl shadow-2xl flex flex-col h-full overflow-hidden"
            >
                {/* Header Container */}
                <div className="p-6 border-b border-border bg-card/90 backdrop-blur-md space-y-4">
                    <SheetHeader className="text-left space-y-1.5">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                                <FolderOpen className="h-5 w-5" />
                            </div>
                            <div>
                                <SheetTitle className="text-lg font-bold text-foreground tracking-tight">
                                    Project Resources
                                </SheetTitle>
                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                    Asset Hub
                                </span>
                            </div>
                        </div>
                        <SheetDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
                            Centralized hub separating Agency Deliverables, Client Uploads, and Staging Environments.
                        </SheetDescription>
                    </SheetHeader>

                    {/* Filter Segment Tabs */}
                    <div className="grid grid-cols-4 gap-1 p-1 bg-muted/60 rounded-xl border border-border text-xs">
                        <button
                            type="button"
                            onClick={() => setActiveTab("all")}
                            className={cn(
                                "py-1.5 px-2 rounded-lg font-medium text-xs transition-all text-center",
                                activeTab === "all" 
                                    ? "bg-background text-foreground shadow-xs font-semibold" 
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            All ({stagingUrls.filter(Boolean).length + documents.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("agency")}
                            className={cn(
                                "py-1.5 px-2 rounded-lg font-medium text-xs transition-all text-center flex items-center justify-center gap-1",
                                activeTab === "agency" 
                                    ? "bg-background text-foreground shadow-xs font-semibold" 
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span>Agency</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                {agencyDocuments.length}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("client")}
                            className={cn(
                                "py-1.5 px-2 rounded-lg font-medium text-xs transition-all text-center flex items-center justify-center gap-1",
                                activeTab === "client" 
                                    ? "bg-background text-foreground shadow-xs font-semibold" 
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span>Client</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                {clientDocuments.length}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("staging")}
                            className={cn(
                                "py-1.5 px-2 rounded-lg font-medium text-xs transition-all text-center",
                                activeTab === "staging" 
                                    ? "bg-background text-foreground shadow-xs font-semibold" 
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Staging ({stagingUrls.filter(Boolean).length})
                        </button>
                    </div>
                </div>

                {/* Main Scrollable Body */}
                <form id="project-resources-form" onSubmit={handleSaveStagingUrls} className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
                    
                    {/* SECTION 1: Agency Resources & Deliverables */}
                    {(activeTab === "all" || activeTab === "agency") && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                        <Briefcase className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Label className="text-sm font-semibold text-foreground">Agency Deliverables & Resources</Label>
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded font-mono border-amber-500/30 text-amber-500 bg-amber-500/10">
                                                {agencyDocuments.length} files
                                            </Badge>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">SOWs, design system links, Figma prototypes, and agency deliverables.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {agencyDocuments.length === 0 ? (
                                    <div className="p-5 text-center border border-dashed border-border rounded-xl bg-muted/10 space-y-1.5">
                                        <FileText className="h-6 w-6 text-muted-foreground mx-auto" />
                                        <p className="text-xs text-foreground font-medium">No agency deliverables attached yet.</p>
                                        <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">Add links to your SOW, Figma files, or design deliverables below.</p>
                                    </div>
                                ) : (
                                    agencyDocuments.map(doc => renderDocumentCard(doc, false))
                                )}

                                {/* Add New Agency Resource Form */}
                                <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                            <Plus className="h-3.5 w-3.5 text-primary" /> Add Agency Resource
                                        </h4>
                                        <div className="flex items-center gap-1 p-0.5 bg-background rounded-lg border border-border text-[10px]">
                                            <button
                                                type="button"
                                                onClick={() => setAddMode("link")}
                                                className={cn(
                                                    "px-2 py-0.5 rounded font-medium transition-all",
                                                    addMode === "link" ? "bg-muted text-foreground font-semibold" : "text-muted-foreground"
                                                )}
                                            >
                                                Link / URL
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAddMode("upload")}
                                                className={cn(
                                                    "px-2 py-0.5 rounded font-medium transition-all",
                                                    addMode === "upload" ? "bg-muted text-foreground font-semibold" : "text-muted-foreground"
                                                )}
                                            >
                                                Upload File
                                            </button>
                                        </div>
                                    </div>

                                    {addMode === "link" ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <Input
                                                    className="bg-background border-border focus:border-primary text-xs text-foreground font-medium rounded-lg h-9 flex-1"
                                                    value={newDocTitle}
                                                    onChange={e => setNewDocTitle(e.target.value)}
                                                    placeholder="Resource Name (e.g. SOW or Figma)"
                                                />
                                                <Select
                                                    value={newDocType}
                                                    onValueChange={(val: any) => setNewDocType(val)}
                                                >
                                                    <SelectTrigger className="w-[130px] h-9 bg-background border-border text-[11px] text-foreground">
                                                        <SelectValue placeholder="Type" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-card border-border text-foreground">
                                                        {DOCUMENT_TYPES.map((t) => (
                                                            <SelectItem key={t.value} value={t.value} className="text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <t.icon className={cn("h-3.5 w-3.5", t.color.split(" ")[0])} />
                                                                    <span>{t.label}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Input
                                                className="bg-background border-border focus:border-primary text-xs text-foreground placeholder:text-muted-foreground rounded-lg h-9"
                                                value={newDocUrl}
                                                onChange={e => setNewDocUrl(e.target.value)}
                                                placeholder="URL (e.g. https://figma.com/... or Google Drive)"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleAddDocumentLink}
                                                disabled={isSaving || !newDocTitle.trim() || !newDocUrl.trim()}
                                                className="w-full text-xs py-2 h-9 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary transition-all rounded-lg mt-1"
                                            >
                                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Resource Link
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="pt-1">
                                            <FileUpload
                                                label="Upload Agency Deliverable / Asset"
                                                accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.zip"
                                                showSuccessToast={false}
                                                projectId={project.id}
                                                onChange={async (url) => {
                                                    if (!url) return;
                                                    setIsSaving(true);
                                                    const fileName = url.split("/").pop() || "Agency Deliverable";
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
                                                        uploadedByName: "Agency PM",
                                                        uploadedByRole: "agency",
                                                        createdAt: new Date().toISOString()
                                                    };
                                                    const res = await addProjectDocument(project.id, newDoc);
                                                    if (res.success) {
                                                        toast.success("Agency deliverable uploaded");
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
                            </div>
                        </div>
                    )}

                    {activeTab === "all" && <div className="border-t border-border" />}

                    {/* SECTION 2: Client Uploads & Supporting Files */}
                    {(activeTab === "all" || activeTab === "client") && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                        <UserCheck className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Label className="text-sm font-semibold text-foreground">Client Uploads & Submissions</Label>
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded font-mono border-sky-500/40 text-sky-400 bg-sky-500/10">
                                                {clientDocuments.length} files
                                            </Badge>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">Files, design briefs, and assets uploaded by the client from their portal.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {clientDocuments.length === 0 ? (
                                    <div className="p-6 text-center border border-dashed border-sky-500/20 rounded-xl bg-sky-500/5 space-y-2">
                                        <UploadCloud className="h-7 w-7 text-sky-400/60 mx-auto" />
                                        <p className="text-xs text-foreground font-medium">No client uploads yet.</p>
                                        <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                                            When the client uploads briefs, brand assets, or revision attachments through the client portal, they will automatically appear here.
                                        </p>
                                    </div>
                                ) : (
                                    clientDocuments.map(doc => renderDocumentCard(doc, true))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "all" && <div className="border-t border-border" />}

                    {/* SECTION 3: Staging & Preview Environments */}
                    {(activeTab === "all" || activeTab === "staging") && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                                        <Globe className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Label className="text-sm font-semibold text-foreground">Staging & Preview Environments</Label>
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded font-mono border-primary/30 text-primary bg-primary/10">
                                                {stagingUrls.filter(u => u.trim()).length} active
                                            </Badge>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">Live deployment links & preview environments for client reviews.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {stagingUrls.map((url, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <Input
                                                className="bg-background border-border focus:border-primary text-xs pl-8 text-foreground placeholder:text-muted-foreground rounded-lg h-9"
                                                value={url}
                                                onChange={e => {
                                                    const newUrls = [...stagingUrls];
                                                    newUrls[i] = e.target.value;
                                                    setStagingUrls(newUrls);
                                                }}
                                                placeholder="https://staging.example.com"
                                            />
                                            <Globe className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                                        </div>
                                        {url.trim() && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                asChild
                                                className="h-9 w-9 border-border bg-background hover:bg-muted text-foreground shrink-0"
                                            >
                                                <a href={url.startsWith("http") ? url : `https://${url}`} target="_blank" rel="noreferrer" title="Open Link">
                                                    <ExternalLink className="h-3.5 w-3.5 text-primary" />
                                                </a>
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setStagingUrls(stagingUrls.filter((_, idx) => idx !== i))}
                                            className="h-9 w-9 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 shrink-0 rounded-lg"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStagingUrls([...stagingUrls, ""])}
                                    className="w-full text-xs py-2 h-9 bg-muted/40 border-dashed border-border hover:border-primary/50 text-foreground transition-all rounded-lg"
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1.5 text-primary" /> Add Environment URL
                                </Button>
                            </div>
                        </div>
                    )}

                </form>

                {/* Footer Action Bar */}
                <div className="p-6 border-t border-border bg-card/90 backdrop-blur-md mt-auto">
                    <Button 
                        type="submit" 
                        form="project-resources-form"
                        disabled={isSaving} 
                        className="w-full bg-primary hover:bg-primary/90 text-black font-bold h-10 shadow-md transition-all rounded-xl cursor-pointer"
                    >
                        {isSaving ? (
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 animate-spin" />
                                <span>Saving Environment URLs...</span>
                            </div>
                        ) : (
                            "Save Environment URLs"
                        )}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
