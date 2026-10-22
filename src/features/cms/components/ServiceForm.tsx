"use client";

import { createService, updateService } from "@/features/cms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
    ExternalLink,
    Sparkles,
    Plus,
    X,
    CheckCircle2,
    PackageCheck,
    Clock,
    Users,
    FileText,
    Wand2,
} from "lucide-react";
import { getServiceMetadataDefaults } from "@/features/cms/constants/service-defaults";

interface ServiceFormProps {
    initialData?: {
        id: string;
        title: string;
        description: string;
        slug?: string | null;
        category?: string | null;
        image?: string | null;
        color?: string | null;
        link?: string | null;
        icon?: string | null;
        order?: number | null;
        isFeatured?: boolean | null;
        inclusions?: unknown;
        deliverables?: unknown;
        scopeOverview?: string | null;
        timelineEstimate?: string | null;
        targetAudience?: string | null;
    };
}

function parseArrayField(val: unknown): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(String).filter(Boolean);
    if (typeof val === "string") {
        try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        } catch {
            return val.split("\n").map((s) => s.trim()).filter(Boolean);
        }
    }
    return [];
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function ServiceForm({ initialData }: ServiceFormProps) {
    const action = initialData ? updateService : createService;
    const [state, formAction, isPending] = useActionState(action, { message: "", success: false });
    
    // Core states
    const [title, setTitle] = useState(initialData?.title || "");
    const [slug, setSlug] = useState(initialData?.slug || (initialData?.title ? slugify(initialData.title) : ""));
    const [category, setCategory] = useState(initialData?.category || "");
    const [image, setImage] = useState(initialData?.image || "");
    const [color, setColor] = useState(initialData?.color || "#05160b");
    const [isFeatured, setIsFeatured] = useState(initialData?.isFeatured ?? false);
    const [timelineEstimate, setTimelineEstimate] = useState(initialData?.timelineEstimate || "2-4 Weeks");
    const [targetAudience, setTargetAudience] = useState(initialData?.targetAudience || "");
    const [scopeOverview, setScopeOverview] = useState(initialData?.scopeOverview || "");

    // Inclusions & Deliverables List Builders
    const [inclusions, setInclusions] = useState<string[]>(() => parseArrayField(initialData?.inclusions));
    const [newInclusion, setNewInclusion] = useState("");

    const [deliverables, setDeliverables] = useState<string[]>(() => parseArrayField(initialData?.deliverables));
    const [newDeliverable, setNewDeliverable] = useState("");

    const router = useRouter();

    useEffect(() => {
        if (state.message) {
            if (state.success) {
                toast.success(state.message);
                router.push("/dashboard/cms");
            } else {
                toast.warning(state.message);
            }
        }
    }, [state, router]);

    const handleTitleChange = (val: string) => {
        setTitle(val);
        // Only auto-update slug if not previously customized
        if (!initialData || !slug || slug === slugify(title)) {
            setSlug(slugify(val));
        }
    };

    const handleAddInclusion = () => {
        const trimmed = newInclusion.trim();
        if (!trimmed) return;
        if (!inclusions.includes(trimmed)) {
            setInclusions([...inclusions, trimmed]);
        }
        setNewInclusion("");
    };

    const handleRemoveInclusion = (index: number) => {
        setInclusions(inclusions.filter((_, i) => i !== index));
    };

    const handleAddDeliverable = () => {
        const trimmed = newDeliverable.trim();
        if (!trimmed) return;
        if (!deliverables.includes(trimmed)) {
            setDeliverables([...deliverables, trimmed]);
        }
        setNewDeliverable("");
    };

    const handleRemoveDeliverable = (index: number) => {
        setDeliverables(deliverables.filter((_, i) => i !== index));
    };

    const handleLoadPresets = () => {
        const presets = getServiceMetadataDefaults(title, category);
        if (inclusions.length === 0) {
            setInclusions(presets.inclusions);
        }
        if (deliverables.length === 0) {
            setDeliverables(presets.deliverables);
        }
        if (!timelineEstimate || timelineEstimate === "2-4 Weeks") {
            setTimelineEstimate(presets.timelineEstimate);
        }
        if (!targetAudience) {
            setTargetAudience(presets.targetAudience);
        }
        if (!scopeOverview) {
            setScopeOverview(presets.scopeOverview);
        }
        toast.info("Applied recommended inclusions, deliverables & scope preset!");
    };

    return (
        <form action={formAction} className="space-y-8">
            {initialData && <input type="hidden" name="id" value={initialData.id} />}
            <input type="hidden" name="image" value={image} />
            <input type="hidden" name="isFeatured" value={isFeatured ? "true" : "false"} />
            <input type="hidden" name="inclusions" value={JSON.stringify(inclusions)} />
            <input type="hidden" name="deliverables" value={JSON.stringify(deliverables)} />

            {/* Top Quick Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-card/60 border border-border">
                <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Need quick templates?</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                        Auto-populate recommended inclusions, timeline, and deliverables based on title.
                    </span>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadPresets}
                    className="border-primary/30 hover:bg-primary/10 text-primary hover:text-primary gap-1.5 font-medium text-xs"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    Load Recommended Inclusions & Scope
                </Button>
            </div>

            <Card className="glass-card border-border">
                <CardContent className="pt-6 space-y-6">
                    {/* Landing Page Showcase Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-primary" />
                                <Label className="text-sm font-semibold text-foreground">
                                    Show on Landing Page Showcase
                                </Label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Feature this service in the landing page interactive modal section (up to 4 services allowed).
                            </p>
                        </div>
                        <Switch
                            checked={isFeatured}
                            onCheckedChange={(checked) => setIsFeatured(checked)}
                        />
                    </div>

                    {/* Service Preview Image for Animated Hover Modal */}
                    <div className="space-y-2">
                        <Label className="text-foreground">Service Preview Image (Shown in Hover Modal)</Label>
                        <ImageUpload
                            value={image}
                            onChange={setImage}
                            label="Upload Service Image"
                        />
                        <p className="text-xs text-muted-foreground">
                            High-resolution 16:9 or 4:3 image displayed when visitors hover over this service.
                        </p>
                    </div>

                    {/* Title and Category */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-foreground">Service Title</Label>
                            <Input
                                name="title"
                                value={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                placeholder="e.g. Custom Web Application Development"
                                className="bg-card border-border text-foreground"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Category / Subtitle Tag</Label>
                            <Input
                                name="category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="e.g. Architecture & Fullstack"
                                className="bg-card border-border text-foreground"
                            />
                        </div>
                    </div>

                    {/* Slug and URL */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-foreground">Slug (URL Identifier)</Label>
                                <button
                                    type="button"
                                    onClick={() => setSlug(slugify(title))}
                                    className="text-[11px] text-primary hover:underline"
                                >
                                    Generate from title
                                </button>
                            </div>
                            <Input
                                name="slug"
                                value={slug}
                                onChange={(e) => setSlug(slugify(e.target.value))}
                                placeholder="custom-web-applications"
                                className="bg-card border-border text-foreground font-mono text-xs"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Destination Link</Label>
                            <Input
                                name="link"
                                defaultValue={initialData?.link || "/contact"}
                                placeholder="/contact"
                                className="bg-card border-border text-foreground"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label className="text-foreground">Short Summary Description</Label>
                        <Textarea
                            name="description"
                            defaultValue={initialData?.description}
                            placeholder="Concise summary for cards and search snippets..."
                            className="bg-card border-border text-foreground"
                            rows={3}
                            required
                        />
                    </div>

                    {/* Scope Overview */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            <Label className="text-foreground font-medium">Detailed Scope Overview</Label>
                        </div>
                        <Textarea
                            name="scopeOverview"
                            value={scopeOverview}
                            onChange={(e) => setScopeOverview(e.target.value)}
                            placeholder="Elaborate on the architectural scope, technical approach, and how Optrizo partners with clients..."
                            className="bg-card border-border text-foreground"
                            rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                            Displayed in the service detail popup modal so prospective leads understand the full depth of the offering.
                        </p>
                    </div>

                    {/* Inclusions Builder Section */}
                    <div className="space-y-3 pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-primary" />
                                    <Label className="text-foreground font-semibold">Service Inclusions</Label>
                                    <Badge variant="outline" className="text-xs text-primary border-primary/30">
                                        {inclusions.length} Added
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Specific deliverables, capabilities, warranties, and features included in this service package.
                                </p>
                            </div>
                        </div>

                        {/* Inclusions list */}
                        {inclusions.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-muted/30 border border-border max-h-64 overflow-y-auto">
                                {inclusions.map((item, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border text-xs group hover:border-primary/40 transition-colors"
                                    >
                                        <div className="flex items-start gap-2 min-w-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shrink-0" />
                                            <span className="text-foreground break-words">{item}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveInclusion(index)}
                                            className="text-muted-foreground hover:text-destructive shrink-0 p-1 rounded hover:bg-muted"
                                            title="Remove item"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl border border-dashed border-border text-center bg-muted/20">
                                <p className="text-xs text-muted-foreground mb-2">No custom inclusions defined yet.</p>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLoadPresets}
                                    className="text-primary hover:text-primary text-xs"
                                >
                                    + Populate with recommended inclusions
                                </Button>
                            </div>
                        )}

                        {/* Add Inclusion input */}
                        <div className="flex items-center gap-2">
                            <Input
                                value={newInclusion}
                                onChange={(e) => setNewInclusion(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddInclusion();
                                    }
                                }}
                                placeholder="e.g. 30-Day post-launch warranty and bugfix coverage"
                                className="bg-card border-border text-foreground text-xs"
                            />
                            <Button
                                type="button"
                                onClick={handleAddInclusion}
                                size="sm"
                                variant="secondary"
                                className="shrink-0 gap-1.5"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add
                            </Button>
                        </div>
                    </div>

                    {/* Deliverables Builder Section */}
                    <div className="space-y-3 pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <PackageCheck className="w-4 h-4 text-primary" />
                                    <Label className="text-foreground font-semibold">Key Deliverables</Label>
                                    <Badge variant="outline" className="text-xs text-primary border-primary/30">
                                        {deliverables.length} Added
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Tangible outputs the client walks away with (e.g. Source Code, Figma Workspace, CI/CD Runbooks).
                                </p>
                            </div>
                        </div>

                        {/* Deliverables list */}
                        {deliverables.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-muted/30 border border-border max-h-48 overflow-y-auto">
                                {deliverables.map((item, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border text-xs group hover:border-primary/40 transition-colors"
                                    >
                                        <div className="flex items-start gap-2 min-w-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0" />
                                            <span className="text-foreground break-words">{item}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveDeliverable(index)}
                                            className="text-muted-foreground hover:text-destructive shrink-0 p-1 rounded hover:bg-muted"
                                            title="Remove item"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl border border-dashed border-border text-center bg-muted/20">
                                <p className="text-xs text-muted-foreground mb-2">No custom deliverables defined yet.</p>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLoadPresets}
                                    className="text-primary hover:text-primary text-xs"
                                >
                                    + Populate with recommended deliverables
                                </Button>
                            </div>
                        )}

                        {/* Add Deliverable input */}
                        <div className="flex items-center gap-2">
                            <Input
                                value={newDeliverable}
                                onChange={(e) => setNewDeliverable(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddDeliverable();
                                    }
                                }}
                                placeholder="e.g. Production Git repository & architecture spec"
                                className="bg-card border-border text-foreground text-xs"
                            />
                            <Button
                                type="button"
                                onClick={handleAddDeliverable}
                                size="sm"
                                variant="secondary"
                                className="shrink-0 gap-1.5"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add
                            </Button>
                        </div>
                    </div>

                    {/* Timeline, Target Audience & Meta Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-primary" />
                                <Label className="text-foreground">Estimated Timeline</Label>
                            </div>
                            <Input
                                name="timelineEstimate"
                                value={timelineEstimate}
                                onChange={(e) => setTimelineEstimate(e.target.value)}
                                placeholder="e.g. 2-4 Weeks or 3-6 Weeks"
                                className="bg-card border-border text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-primary" />
                                <Label className="text-foreground">Target Audience</Label>
                            </div>
                            <Input
                                name="targetAudience"
                                value={targetAudience}
                                onChange={(e) => setTargetAudience(e.target.value)}
                                placeholder="e.g. Early-stage Founders, Scale-ups & Enterprises"
                                className="bg-card border-border text-foreground"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-foreground">Modal Accent Color</Label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="w-10 h-10 rounded border border-border bg-transparent cursor-pointer"
                                />
                                <Input
                                    name="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    placeholder="#05160b"
                                    className="bg-card border-border text-foreground font-mono text-xs"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-foreground">Display Order</Label>
                            <Input
                                name="order"
                                type="number"
                                defaultValue={initialData?.order ?? 0}
                                placeholder="0"
                                className="bg-card border-border text-foreground"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-foreground">
                                Icon Name (Lucide)
                                <a
                                    href="https://lucide.dev/icons"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ml-2 text-xs text-primary underline inline-flex items-center"
                                >
                                    Browse <ExternalLink className="ml-1 h-3 w-3" />
                                </a>
                            </Label>
                            <Input
                                name="icon"
                                defaultValue={initialData?.icon || "Code"}
                                placeholder="e.g. Code, Smartphone, Rocket"
                                className="bg-card border-border text-foreground"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
                <Button type="button" variant="ghost" onClick={() => router.back()} className="hover:bg-muted text-foreground">
                    Cancel
                </Button>
                <Button type="submit" disabled={isPending} className="bg-primary text-black font-semibold hover:bg-primary/90">
                    {isPending ? "Saving..." : (initialData ? "Update Service" : "Create Service")}
                </Button>
            </div>
        </form>
    );
}
