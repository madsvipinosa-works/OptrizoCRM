"use client";

import { useActionState, useEffect } from "react";
import { updateHeroSettings } from "@/features/cms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles, Video, Save, ExternalLink, HelpCircle } from "lucide-react";
import Link from "next/link";

interface HeroTabProps {
    settings: {
        heroTitle?: string | null;
        heroDescription?: string | null;
        demoVideoUrl?: string | null;
    } | null;
}

export function HeroTab({ settings }: HeroTabProps) {
    const [state, formAction, isPending] = useActionState(updateHeroSettings, {
        message: "",
        success: false,
    });

    useEffect(() => {
        if (state.message) {
            if (state.success) {
                toast.success(state.message);
            } else {
                toast.error(state.message);
            }
        }
    }, [state]);

    return (
        <form action={formAction} className="space-y-6 max-w-4xl">
            {/* Top Info Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-primary/10 border border-primary/20 text-foreground">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20 text-primary shrink-0">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-foreground">Homepage Hero & Video Control</h4>
                        <p className="text-xs text-muted-foreground">
                            Update the main headline, subtitle, and interactive demo video showcased on the public homepage.
                        </p>
                    </div>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 border-border text-foreground hover:bg-muted">
                    <Link href="/" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Preview Homepage
                    </Link>
                </Button>
            </div>

            {/* Hero Copy Card */}
            <Card className="glass-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Hero Headline & Description
                    </CardTitle>
                    <CardDescription>
                        Customise the primary headline and value proposition displayed in the 3D Experience Hero.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="heroTitle" className="text-foreground font-medium">Hero Headline</Label>
                            <span className="text-xs text-muted-foreground">Default: OPTRIZO</span>
                        </div>
                        <Input
                            id="heroTitle"
                            name="heroTitle"
                            defaultValue={settings?.heroTitle ?? "OPTRIZO"}
                            placeholder="e.g. OPTRIZO or NEXT-GEN SOFTWARE"
                            className="bg-card border-border text-foreground"
                        />
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <HelpCircle className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                            This headline forms the large bold title in the hero and is used as the browser tab title.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="heroDescription" className="text-foreground font-medium">Hero Subtitle & Value Proposition</Label>
                            <span className="text-xs text-muted-foreground">Displayed below the typewriter banner</span>
                        </div>
                        <Textarea
                            id="heroDescription"
                            name="heroDescription"
                            rows={3}
                            defaultValue={settings?.heroDescription ?? "We engineer bespoke web platforms, enterprise software, and scalable digital infrastructure through modern architecture."}
                            placeholder="Describe what your agency does..."
                            className="bg-card border-border text-foreground resize-none"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Demo Video Card */}
            <Card className="glass-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Video className="w-5 h-5 text-primary" />
                        Homepage Demo Video
                    </CardTitle>
                    <CardDescription>
                        Control the interactive 3D container scroll video animation that unfolds right below the hero.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="demoVideoUrl" className="text-foreground font-medium">Video Embed URL</Label>
                        <Input
                            id="demoVideoUrl"
                            name="demoVideoUrl"
                            defaultValue={settings?.demoVideoUrl ?? ""}
                            placeholder="https://www.youtube.com/embed/VIDEO_ID or direct .mp4 link"
                            className="bg-card border-border text-foreground font-mono text-xs"
                        />
                    </div>

                    <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground space-y-1.5">
                        <p className="font-semibold text-foreground">Supported Video Formats:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                            <li><strong className="text-foreground">YouTube:</strong> Standard embed URL (<code className="text-primary font-mono">https://www.youtube.com/embed/dQw4w9WgXcQ</code>) or watch URL</li>
                            <li><strong className="text-foreground">Vimeo:</strong> Embed player link (<code className="text-primary font-mono">https://player.vimeo.com/video/...</code>)</li>
                            <li><strong className="text-foreground">Direct MP4:</strong> Any direct video URL ending in <code className="text-primary font-mono">.mp4</code></li>
                        </ul>
                        <p className="text-[11px] text-muted-foreground/80 pt-1">
                            Leave this field empty if you do not want to display a video section on the homepage.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
                <Button
                    type="submit"
                    size="lg"
                    disabled={isPending}
                    className="bg-primary text-black font-bold hover:bg-primary/90 min-w-[180px] shadow-lg shadow-primary/20"
                >
                    {isPending ? (
                        "Saving Changes..."
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Hero Settings
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
}
