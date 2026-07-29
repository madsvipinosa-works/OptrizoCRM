"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FolderOpen, Plus, Trash2, ExternalLink, Globe, FileText, FileCode2, Palette, Table, Link2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { updateProjectSettings } from "@/features/pm/actions";
import { type ProjectDocumentItem } from "@/db/schema";
import { cn } from "@/lib/utils";

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
] as const;

export function ProjectResourcesSidebar({ project }: ProjectResourcesSidebarProps) {
    const [open, setOpen] = useState(false);
    const [stagingUrls, setStagingUrls] = useState<string[]>(project.stagingUrls || []);
    const [documents, setDocuments] = useState<ProjectDocumentItem[]>(project.documents || []);
    const [isSaving, setIsSaving] = useState(false);

    const handleAddDocument = () => {
        const newDoc: ProjectDocumentItem = {
            id: crypto.randomUUID(),
            title: "",
            url: "",
            type: "pdf",
        };
        setDocuments([...documents, newDoc]);
    };

    const handleUpdateDocument = (id: string, field: keyof ProjectDocumentItem, value: string) => {
        setDocuments(prev =>
            prev.map(doc => (doc.id === id ? { ...doc, [field]: value } : doc))
        );
    };

    const handleRemoveDocument = (id: string) => {
        setDocuments(prev => prev.filter(doc => doc.id !== id));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        const cleanUrls = stagingUrls.filter(u => u.trim() !== "");
        const cleanDocs = documents
            .filter(d => d.title.trim() !== "" || d.url.trim() !== "")
            .map(d => ({
                ...d,
                title: d.title.trim() || "Untitled Document",
                url: d.url.trim()
            }));

        const res = await updateProjectSettings(project.id, cleanUrls, cleanDocs);
        setIsSaving(false);

        if (res.success) {
            toast.success("Project resources & documents saved!");
            setOpen(false);
        } else {
            toast.error(res.message || "Failed to save project resources.");
        }
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button 
                    variant="outline" 
                    className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200 transition-all shadow-sm"
                >
                    <FolderOpen className="h-4 w-4 mr-2 text-indigo-400" />
                    Project Resources
                </Button>
            </SheetTrigger>
            <SheetContent 
                side="right" 
                className="w-full sm:max-w-lg p-0 bg-zinc-950/95 text-white border-l border-white/10 backdrop-blur-2xl shadow-2xl flex flex-col h-full overflow-hidden"
            >
                {/* Header Container with explicit padding & border */}
                <div className="p-6 border-b border-white/10 bg-zinc-900/60 backdrop-blur-md">
                    <SheetHeader className="text-left space-y-1.5">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                <FolderOpen className="h-5 w-5" />
                            </div>
                            <div>
                                <SheetTitle className="text-lg font-bold text-white tracking-tight">
                                    Project Resources
                                </SheetTitle>
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                    Asset Hub
                                </span>
                            </div>
                        </div>
                        <SheetDescription className="text-xs text-zinc-400 leading-relaxed pt-1">
                            Centralized repository for deployment previews, Figma designs, PDFs, and client documentation.
                        </SheetDescription>
                    </SheetHeader>
                </div>

                {/* Main Scrollable Body with generous side margin & padding */}
                <form id="project-resources-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-zinc-800">
                    
                    {/* Section 1: Staging & Preview URLs */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    <Globe className="h-4 w-4" />
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-zinc-200">Staging & Preview URLs</Label>
                                    <p className="text-[11px] text-zinc-400">Deployment links & live preview environments.</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {stagingUrls.map((url, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            className="bg-zinc-900/90 border-zinc-800 focus:border-indigo-500/50 text-xs pl-8 text-zinc-200 placeholder:text-zinc-600 rounded-lg h-9"
                                            value={url}
                                            onChange={e => {
                                                const newUrls = [...stagingUrls];
                                                newUrls[i] = e.target.value;
                                                setStagingUrls(newUrls);
                                            }}
                                            placeholder="https://staging.example.com"
                                        />
                                        <Globe className="h-3.5 w-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                    </div>
                                    {url.trim() && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            asChild
                                            className="h-9 w-9 border-zinc-800 bg-zinc-900/90 hover:bg-indigo-500/20 text-zinc-300 hover:text-indigo-300 shrink-0"
                                        >
                                            <a href={url.startsWith("http") ? url : `https://${url}`} target="_blank" rel="noreferrer" title="Open Link">
                                                <ExternalLink className="h-3.5 w-3.5" />
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
                                className="w-full text-xs py-2 h-9 bg-zinc-900/40 border-dashed border-zinc-800 hover:border-indigo-500/40 hover:bg-indigo-500/5 text-indigo-300 transition-all rounded-lg"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Environment URL
                            </Button>
                        </div>
                    </div>

                    <div className="border-t border-white/10" />

                    {/* Section 2: Documents & Files Hub */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-zinc-200">Documents & Attachments</Label>
                                    <p className="text-[11px] text-zinc-400">PDFs, Google Docs, Figma files, and project specifications.</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {documents.length === 0 ? (
                                <div className="p-6 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30 space-y-2">
                                    <FileText className="h-8 w-8 text-zinc-600 mx-auto" />
                                    <p className="text-xs text-zinc-400 font-medium">No documents attached yet.</p>
                                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">Add links to your SOW, Figma files, Google Docs, or PDF assets for the team.</p>
                                </div>
                            ) : (
                                documents.map((doc) => {
                                    const typeInfo = DOCUMENT_TYPES.find(t => t.value === doc.type) || DOCUMENT_TYPES[0];
                                    const IconComponent = typeInfo.icon;

                                    return (
                                        <div 
                                            key={doc.id} 
                                            className="p-4 rounded-xl border border-white/10 bg-zinc-900/70 hover:border-white/20 transition-all space-y-3 shadow-md"
                                        >
                                            {/* Top Row: Title + Type Dropdown + Action Buttons */}
                                            <div className="flex items-center gap-2">
                                                <div className={cn("p-2 rounded-lg border shrink-0", typeInfo.color)}>
                                                    <IconComponent className="h-4 w-4" />
                                                </div>
                                                <Input
                                                    className="bg-zinc-950/80 border-zinc-800 focus:border-indigo-500/50 text-xs text-zinc-100 font-medium rounded-lg h-9 flex-1"
                                                    value={doc.title}
                                                    onChange={e => handleUpdateDocument(doc.id, "title", e.target.value)}
                                                    placeholder="Document Name (e.g. Project SOW / PDF)"
                                                />
                                                <Select
                                                    value={doc.type}
                                                    onValueChange={(val) => handleUpdateDocument(doc.id, "type", val)}
                                                >
                                                    <SelectTrigger className="w-[125px] h-9 bg-zinc-950/80 border-zinc-800 text-[11px] text-zinc-300">
                                                        <SelectValue placeholder="Type" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
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

                                            {/* Bottom Row: URL Input + Launch Link + Remove Button */}
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <Input
                                                        className="bg-zinc-950/80 border-zinc-800 focus:border-indigo-500/50 text-xs pl-8 text-zinc-300 placeholder:text-zinc-600 rounded-lg h-9"
                                                        value={doc.url}
                                                        onChange={e => handleUpdateDocument(doc.id, "url", e.target.value)}
                                                        placeholder="https://drive.google.com/file/... or https://figma.com/file/..."
                                                    />
                                                    <Link2 className="h-3.5 w-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                                </div>
                                                {doc.url.trim() && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        asChild
                                                        className="h-9 w-9 border-zinc-800 bg-zinc-950/80 hover:bg-purple-500/20 text-zinc-300 hover:text-purple-300 shrink-0"
                                                    >
                                                        <a href={doc.url.startsWith("http") ? doc.url : `https://${doc.url}`} target="_blank" rel="noreferrer" title="Open Document">
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </a>
                                                    </Button>
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveDocument(doc.id)}
                                                    className="h-9 w-9 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 shrink-0 rounded-lg"
                                                    title="Delete Document"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAddDocument}
                                className="w-full text-xs py-2 h-9 bg-purple-500/5 border-dashed border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/10 text-purple-300 transition-all rounded-lg"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Document / Asset Link
                            </Button>
                        </div>
                    </div>

                </form>

                {/* Footer Action Bar with explicit margins & background */}
                <div className="p-6 border-t border-white/10 bg-zinc-900/80 backdrop-blur-md mt-auto">
                    <Button 
                        type="submit" 
                        form="project-resources-form"
                        disabled={isSaving} 
                        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold h-10 shadow-lg shadow-indigo-500/25 transition-all rounded-xl"
                    >
                        {isSaving ? (
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 animate-spin" />
                                <span>Saving Resources...</span>
                            </div>
                        ) : (
                            "Save Resources & Documents"
                        )}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
