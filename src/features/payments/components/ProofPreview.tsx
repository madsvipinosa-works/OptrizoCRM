"use client";

import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const isPdf = (url: string) => /\.pdf(?:$|[&?#])/i.test(decodeURIComponent(url));

/**
 * Opens a payment proof inside the app: the image or PDF shows in a dialog, with an
 * "Open in new tab" link as a fallback. The file still comes through the private file route,
 * so only people with access to the project can see it.
 */
export function ProofPreview({ url, label = "View proof", title = "Payment proof" }: { url: string; label?: string; title?: string }) {
    const [open, setOpen] = useState(false);
    const [broken, setBroken] = useState(false);

    return (
        <>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-brand-deep" onClick={() => { setBroken(false); setOpen(true); }}>
                <FileText className="size-3.5" aria-hidden="true" /> {label}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>Shown only to people on this project.</DialogDescription>
                    </DialogHeader>
                    <div className="flex min-h-64 items-center justify-center overflow-auto rounded-lg border border-border bg-muted/30">
                        {broken ? (
                            <p className="p-6 text-center text-sm text-muted-foreground">
                                This file could not be shown here. It may be missing from storage, or it is a type the browser cannot preview.
                            </p>
                        ) : isPdf(url) ? (
                            <iframe src={url} title={title} className="h-[65vh] w-full" />
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element -- a private, proxied file; next/image cannot optimise it
                            <img src={url} alt={title} onError={() => setBroken(true)} className="max-h-[65vh] w-auto max-w-full object-contain" />
                        )}
                    </div>
                    <div className="flex justify-end">
                        <Button asChild variant="outline" size="sm" className="rounded-lg">
                            <a href={url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="size-3.5" aria-hidden="true" /> Open in new tab
                            </a>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
