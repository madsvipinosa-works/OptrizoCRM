"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    CheckCircle2,
    Clock,
    Users,
    PackageCheck,
    ArrowRight,
    MessageSquare,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import { getServiceMetadataDefaults } from "@/features/cms/constants/service-defaults";

export interface ServiceDetailItem {
    id: string;
    title: string;
    description: string;
    slug?: string | null;
    category?: string | null;
    image?: string | null;
    color?: string | null;
    link?: string | null;
    icon?: string | null;
    inclusions?: string[] | null;
    deliverables?: string[] | null;
    scopeOverview?: string | null;
    timelineEstimate?: string | null;
    targetAudience?: string | null;
}

interface ServiceDetailModalProps {
    service: ServiceDetailItem | null;
    isOpen: boolean;
    onClose: () => void;
    onAvailClick?: (service: ServiceDetailItem) => void;
}

export function ServiceDetailModal({
    service,
    isOpen,
    onClose,
    onAvailClick,
}: ServiceDetailModalProps) {
    if (!service) return null;

    const defaults = getServiceMetadataDefaults(service.title, service.category ?? undefined);
    
    // Only what the content editor entered, so this always matches the service card (no made-up defaults).
    const inclusions = service.inclusions ?? [];

    const deliverables = (service.deliverables && service.deliverables.length > 0)
        ? service.deliverables
        : defaults.deliverables;

    const timeline = service.timelineEstimate || defaults.timelineEstimate;
    const audience = service.targetAudience || defaults.targetAudience;
    const scopeOverview = service.scopeOverview || defaults.scopeOverview;

    const handleAvail = () => {
        if (onAvailClick) {
            onAvailClick(service);
        } else {
            window.location.href = `/portal/request-proposal?serviceId=${encodeURIComponent(service.id)}`;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto p-0 bg-card border-border text-card-foreground rounded-2xl override-scrollbar"
                aria-describedby="service-detail-description"
            >
                {/* Visual Header / Cover Media */}
                {service.image ? (
                    <div className="relative w-full h-52 sm:h-64 overflow-hidden bg-card">
                        <Image
                            src={service.image}
                            alt={service.title}
                            fill
                            className="object-cover"
                            priority
                        />
                        <div className="absolute inset-0 from-card via-card/50 to-transparent" />
                        <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between">
                            {service.category && (
                                <Badge className="bg-primary/90 text-primary-foreground text-xs">{service.category}</Badge>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="pt-6 px-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-primary/10 text-brand-deep border border-primary/20 text-xs tabular-nums ">
                                {service.category || "Optrizo Practice Area"}
                            </Badge>
                            <span className="tabular-nums text-xs text-muted-foreground flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                Service
                            </span>
                        </div>
                    </div>
                )}

                {/* Content Body */}
                <div className="p-6 sm:p-8 space-y-6">
                    <DialogHeader className="text-left space-y-2">
                        <DialogTitle className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground ">
                            {service.title}
                        </DialogTitle>
                        <DialogDescription id="service-detail-description" className="text-base text-muted-foreground leading-relaxed">
                            {service.description}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Metadata Pills: Timeline & Target Audience */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-brand-deep shrink-0">
                                <Clock className="w-4 h-4" />
                            </div>
                            <div>
                                <span className="text-xs tabular-nums text-muted-foreground block">
                                    Typical timeline
                                </span>
                                <span className="text-xs font-semibold text-foreground">
                                    {timeline}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 sm:border-l border-border sm:pl-4">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-brand-deep shrink-0">
                                <Users className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-xs tabular-nums text-muted-foreground block">
                                    Best for
                                </span>
                                <span className="text-xs font-semibold text-foreground truncate block">
                                    {audience}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Scope Overview */}
                    {scopeOverview && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-brand-deep" />
                                <h4 className="text-xs tabular-nums font-semibold text-muted-foreground">
                                    How we approach it
                                </h4>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed p-4 rounded-xl bg-muted/20 border border-border">
                                {scopeOverview}
                            </p>
                        </div>
                    )}

                    {/* Inclusions Breakdown: hidden when the editor listed none. */}
                    {inclusions.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-brand-deep" />
                                <h3 className="text-sm font-semibold text-foreground">
                                    What&apos;s included
                                </h3>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {inclusions.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-start gap-2.5 p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors shadow-xs"
                                >
                                    <div className="mt-0.5 w-4 h-4 rounded-full bg-primary/10 text-brand-deep flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs text-foreground font-medium leading-snug">
                                        {item}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    )}

                    {/* Deliverables Breakdown */}
                    {deliverables.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <PackageCheck className="w-4 h-4 text-brand-deep" />
                                <h4 className="text-xs tabular-nums font-semibold text-foreground">
                                    What you receive
                                </h4>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {deliverables.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border text-xs text-foreground tabular-nums"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-deep shrink-0" />
                                        <span className="truncate">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quality Guarantees Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs">
                        <div className="flex items-center gap-2 text-foreground font-medium">
                            <ShieldCheck className="w-4 h-4 text-brand-deep" />
                            <span>You own the code</span>
                        </div>
                        <span className="text-muted-foreground text-xs tabular-nums">
                            No lock-in. You get the full handover.
                        </span>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                        <Button
                            onClick={handleAvail}
                            size="lg"
                            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-md gap-2"
                        >
                            <span>Avail This Service</span>
                            <ArrowRight className="w-4 h-4" />
                        </Button>

                        <Button
                            asChild
                            variant="outline"
                            size="lg"
                            className="border-border hover:bg-muted text-foreground font-semibold rounded-xl bg-transparent gap-2"
                        >
                            <Link href="/contact" onClick={onClose}>
                                <MessageSquare className="w-4 h-4" />
                                <span>Contact Us</span>
                            </Link>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
