"use client";

import { createService, updateService } from "@/features/cms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import { Switch } from "@/components/ui/switch";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Sparkles } from "lucide-react";

interface ServiceFormProps {
    initialData?: {
        id: string;
        title: string;
        description: string;
        category?: string | null;
        image?: string | null;
        color?: string | null;
        link?: string | null;
        icon?: string | null;
        order?: number | null;
        isFeatured?: boolean | null;
    };
}

export function ServiceForm({ initialData }: ServiceFormProps) {
    const action = initialData ? updateService : createService;
    const [state, formAction, isPending] = useActionState(action, { message: "", success: false });
    const [image, setImage] = useState(initialData?.image || "");
    const [color, setColor] = useState(initialData?.color || "#05160b");
    const [isFeatured, setIsFeatured] = useState(initialData?.isFeatured ?? false);
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

    return (
        <form action={formAction} className="space-y-8">
            {initialData && <input type="hidden" name="id" value={initialData.id} />}
            <input type="hidden" name="image" value={image} />
            <input type="hidden" name="isFeatured" value={isFeatured ? "true" : "false"} />

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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-foreground">Service Title</Label>
                            <Input
                                name="title"
                                defaultValue={initialData?.title}
                                placeholder="e.g. Custom Web Application Development"
                                className="bg-card border-border text-foreground"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Category / Subtitle Tag</Label>
                            <Input
                                name="category"
                                defaultValue={initialData?.category || ""}
                                placeholder="e.g. Design & Architecture"
                                className="bg-card border-border text-foreground"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-foreground">Description</Label>
                        <Textarea
                            name="description"
                            defaultValue={initialData?.description}
                            placeholder="Describe the service offering..."
                            className="bg-card border-border text-foreground"
                            rows={3}
                            required
                        />
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
                            <Label className="text-foreground">Destination Link</Label>
                            <Input
                                name="link"
                                defaultValue={initialData?.link || "/contact"}
                                placeholder="/contact"
                                className="bg-card border-border text-foreground"
                            />
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
                                Browse Icons <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                        </Label>
                        <Input
                            name="icon"
                            defaultValue={initialData?.icon || "Code"}
                            placeholder="e.g. Code, Smartphone, Rocket, Cpu"
                            className="bg-card border-border text-foreground"
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
                <Button type="button" variant="ghost" onClick={() => router.back()} className="hover:bg-muted text-foreground">Cancel</Button>
                <Button type="submit" disabled={isPending} className="bg-primary text-black font-semibold hover:bg-primary/90">
                    {isPending ? "Saving..." : (initialData ? "Update Service" : "Create Service")}
                </Button>
            </div>
        </form>
    );
}
