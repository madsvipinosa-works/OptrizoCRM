"use client";

import { useActionState, useEffect, useState } from "react";
import { updateAboutContent } from "@/features/cms/about-actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";

export interface AboutSettingsData {
    aboutHeroTitle?: string | null;
    missionStatement?: string | null;
    companyStats?: string | null;
    aboutTechStack?: string | null;
    aboutTechStackItems?: string | null;
    aboutCtaHeadline?: string | null;
    aboutCtaText?: string | null;
}

export function AboutSettingsForm({ initialData }: { initialData: AboutSettingsData }) {
    const [state, formAction, isPending] = useActionState(updateAboutContent, { message: "", success: false });

    const [stats, setStats] = useState<{ label: string; value: string }[]>(() => {
        if (!initialData?.companyStats) return [];
        try {
            return JSON.parse(initialData.companyStats);
        } catch {
            return [];
        }
    });

    const [techStack, setTechStack] = useState<{ name: string; imageUrl: string }[]>(() => {
        if (!initialData?.aboutTechStackItems) return [];
        try {
            return JSON.parse(initialData.aboutTechStackItems);
        } catch {
            return [];
        }
    });

    useEffect(() => {
        if (state.message) {
            if (state.success) toast.success(state.message);
            else toast.error(state.message);
        }
    }, [state]);

    const addStat = () => {
        setStats([...stats, { label: "", value: "" }]);
    };

    const removeStat = (index: number) => {
        setStats(stats.filter((_, i) => i !== index));
    };

    const updateStat = (index: number, field: "label" | "value", val: string) => {
        const newStats = [...stats];
        newStats[index][field] = val;
        setStats(newStats);
    };

    const addTech = () => {
        setTechStack([...techStack, { name: "", imageUrl: "" }]);
    };

    const removeTech = (index: number) => {
        setTechStack(techStack.filter((_, i) => i !== index));
    };

    const updateTech = (index: number, field: "name" | "imageUrl", val: string) => {
        const newTech = [...techStack];
        newTech[index][field] = val;
        setTechStack(newTech);
    };

    return (
        <form action={formAction} className="space-y-8">
            <Card className="bg-black/40 border-primary/20">
                <CardHeader>
                    <CardTitle>Hero & Mission</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Hero Headline</Label>
                        <Input
                            name="aboutHeroTitle"
                            defaultValue={initialData?.aboutHeroTitle || "About Our Agency"}
                            placeholder="About Our Agency"
                            className="bg-white/5 border-white/10"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>The Mission Statement</Label>
                        <Textarea
                            name="missionStatement"
                            defaultValue={initialData?.missionStatement || ""}
                            placeholder="We build digital experiences that elevate brands..."
                            className="bg-white/5 border-white/10 min-h-[100px]"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-black/40 border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Company Stats</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={addStat}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Stat
                    </Button>
                </CardHeader>
                <CardContent>
                    {/* Hidden input to store JSON array */}
                    <input type="hidden" name="companyStats" value={JSON.stringify(stats)} />

                    <div className="space-y-4">
                        {stats.length === 0 && (
                            <p className="text-muted-foreground text-sm italic">No stats defined. Add some to show on the About page.</p>
                        )}
                        {stats.map((stat, i) => (
                            <div key={i} className="flex items-center gap-4 bg-white/5 p-3 rounded-md border border-white/10">
                                <div className="flex-1 space-y-1">
                                    <Label className="text-xs text-muted-foreground">Label (e.g. &quot;Projects Delivered&quot;)</Label>
                                    <Input
                                        value={stat.label}
                                        onChange={(e) => updateStat(i, "label", e.target.value)}
                                        className="bg-transparent border-white/20 h-8"
                                    />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <Label className="text-xs text-muted-foreground">Value (e.g. &quot;50+&quot;)</Label>
                                    <Input
                                        value={stat.value}
                                        onChange={(e) => updateStat(i, "value", e.target.value)}
                                        className="bg-transparent border-white/20 h-8 font-mono text-primary"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeStat(i)}
                                    className="mt-5 text-red-500 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-black/40 border-primary/20">
                <CardHeader>
                    <CardTitle>Tech Stack & CTA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Tech Stack Subheading</Label>
                        <Input
                            name="aboutTechStack"
                            defaultValue={initialData?.aboutTechStack || "Powered By Next-Generation Technologies"}
                            className="bg-white/5 border-white/10"
                        />
                    </div>
                    
                    <div className="pt-4 border-t border-white/10 space-y-4">
                        <div className="flex flex-row items-center justify-between">
                            <h4 className="text-sm font-semibold">Tech Stack Logos</h4>
                            <Button type="button" variant="outline" size="sm" onClick={addTech}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Logo
                            </Button>
                        </div>
                        
                        <input type="hidden" name="aboutTechStackItems" value={JSON.stringify(techStack)} />

                        <div className="space-y-4">
                            {techStack.length === 0 && (
                                <p className="text-muted-foreground text-sm italic">No logos added. The tech stack row will be hidden until you add some.</p>
                            )}
                            {techStack.map((tech, i) => (
                                <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white/5 p-4 rounded-md border border-white/10">
                                    <div className="w-full sm:w-24 shrink-0">
                                        <ImageUpload
                                            value={tech.imageUrl}
                                            onChange={(url) => updateTech(i, "imageUrl", url)}
                                            label="Logo (SVG/PNG)"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1 w-full">
                                        <Label className="text-xs text-muted-foreground">Technology Name</Label>
                                        <Input
                                            value={tech.name}
                                            onChange={(e) => updateTech(i, "name", e.target.value)}
                                            className="bg-transparent border-white/20 h-8 font-mono text-primary"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeTech(i)}
                                        className="text-red-500 hover:text-red-400 hover:bg-red-500/10 shrink-0 mt-4 sm:mt-0"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="pt-4 border-t border-white/10 space-y-4">
                        <h4 className="text-sm font-semibold">Call to Action (CTA) Form</h4>
                        <div className="space-y-2">
                            <Label>CTA Headline</Label>
                            <Input
                                name="aboutCtaHeadline"
                                defaultValue={initialData?.aboutCtaHeadline || "Ready to start your next project?"}
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>CTA Subtitle</Label>
                            <Input
                                name="aboutCtaText"
                                defaultValue={initialData?.aboutCtaText || "Let's build something extraordinary together."}
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Button type="submit" size="lg" disabled={isPending} className="bg-primary text-black font-bold">
                {isPending ? "Saving Settings..." : "Save Settings"}
            </Button>
        </form>
    );
}
