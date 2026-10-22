"use client";

import { AboutSettingsForm, type AboutSettingsData } from "@/features/cms/about/components/AboutSettingsForm";
import { ValuesManager } from "@/features/cms/about/components/ValuesManager";
import { Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface AboutTabProps {
    settings: AboutSettingsData;
    values: any[];
}

export function AboutTab({ settings, values }: AboutTabProps) {
    return (
        <div className="space-y-8 max-w-4xl">
            {/* Info Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-foreground">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 shrink-0">
                        <Info className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-foreground">About Us Page Content & Bento Grid</h4>
                        <p className="text-xs text-muted-foreground">
                            Manage the mission statement, company stats, tech stack items, and Bento Box value cards displayed on <code className="text-purple-400 font-mono">/about</code>.
                        </p>
                    </div>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 border-border text-foreground hover:bg-muted">
                    <Link href="/about" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Preview /about
                    </Link>
                </Button>
            </div>

            {/* Core Stats, Mission & Tech Stack Form */}
            <AboutSettingsForm initialData={settings || {}} />

            {/* Bento Grid Values Manager */}
            <div className="pt-6 border-t border-border">
                <ValuesManager initialValues={values} />
            </div>
        </div>
    );
}
