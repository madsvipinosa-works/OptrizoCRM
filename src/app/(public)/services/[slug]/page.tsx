import { db } from "@/db";
import { services } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Clock,
    Users,
    PackageCheck,
    ShieldCheck,
    MessageSquare,
    Sparkles,
} from "lucide-react";
import { getServiceMetadataDefaults } from "@/features/cms/constants/service-defaults";
import type { Metadata } from "next";

export const revalidate = 3600;

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const service = await db.query.services.findFirst({
        where: or(eq(services.slug, slug), eq(services.id, slug)),
    });

    if (!service) {
        return {
            title: "Service Not Found | Optrizo",
        };
    }

    return {
        title: `${service.title} | Optrizo Custom Solutions`,
        description: service.description,
        openGraph: {
            title: service.title,
            description: service.description,
            images: service.image ? [service.image] : undefined,
        },
    };
}

export default async function ServiceDetailPage({ params }: PageProps) {
    const { slug } = await params;

    const service = await db.query.services.findFirst({
        where: or(eq(services.slug, slug), eq(services.id, slug)),
    });

    if (!service) {
        notFound();
    }

    const defaults = getServiceMetadataDefaults(service.title, service.category ?? undefined);
    const inclusions = (Array.isArray(service.inclusions) && service.inclusions.length > 0)
        ? (service.inclusions as string[])
        : defaults.inclusions;

    const deliverables = (Array.isArray(service.deliverables) && service.deliverables.length > 0)
        ? (service.deliverables as string[])
        : defaults.deliverables;

    const timeline = service.timelineEstimate || defaults.timelineEstimate;
    const audience = service.targetAudience || defaults.targetAudience;
    const scopeOverview = service.scopeOverview || defaults.scopeOverview;

    return (
        <div className="relative min-h-screen bg-background text-foreground overflow-hidden font-sans">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px] -translate-y-1/2 pointer-events-none" />
            <div className="absolute top-1/3 right-0 w-[450px] h-[450px] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="container relative z-10 mx-auto px-4 pt-32 pb-24 max-w-5xl">
                {/* Back Link */}
                <div className="mb-8">
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 -ml-2">
                        <Link href="/services">
                            <ArrowLeft className="w-4 h-4" />
                            <span>All Practice Areas</span>
                        </Link>
                    </Button>
                </div>

                {/* Hero Header */}
                <div className="space-y-6 mb-12">
                    <div className="flex flex-wrap items-center gap-3">
                        <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs font-mono tracking-widest uppercase py-1 px-3">
                            {service.category || "Optrizo Solution"}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5 bg-card/60 border border-border px-3 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            Active Engagement Offering
                        </span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-foreground">
                        {service.title}
                    </h1>

                    <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-3xl">
                        {service.description}
                    </p>

                    {/* Metadata Chips: Timeline & Audience */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-card/70 backdrop-blur-xl border border-border shadow-sm">
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider block">
                                    Expected Delivery Sprints
                                </span>
                                <span className="text-sm font-bold text-foreground">
                                    {timeline}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3.5 sm:border-l border-border sm:pl-6">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                                <Users className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider block">
                                    Target Profile
                                </span>
                                <span className="text-sm font-bold text-foreground truncate block">
                                    {audience}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hero Media */}
                {service.image && (
                    <div className="relative w-full h-72 sm:h-96 rounded-3xl overflow-hidden border border-border shadow-xl mb-14 bg-muted/40">
                        <Image
                            src={service.image}
                            alt={service.title}
                            fill
                            priority
                            className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                    </div>
                )}

                {/* Scope & Philosophy */}
                {scopeOverview && (
                    <div className="mb-14 p-6 sm:p-8 rounded-3xl bg-card/60 backdrop-blur-xl border border-border space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                            <Sparkles className="w-5 h-5" />
                            <h2 className="text-sm font-mono font-bold uppercase tracking-wider">
                                Technical Scope & Architectural Philosophy
                            </h2>
                        </div>
                        <p className="text-base text-muted-foreground leading-relaxed">
                            {scopeOverview}
                        </p>
                    </div>
                )}

                {/* Inclusions Grid */}
                <div className="mb-14 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border pb-4">
                        <div>
                            <span className="text-xs font-mono text-primary uppercase tracking-widest block mb-1">
                                Comprehensive Coverage
                            </span>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground uppercase tracking-tight">
                                What&apos;s Included In This Service
                            </h2>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">
                            {inclusions.length} Core Engineering Pillars
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {inclusions.map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-3 p-4 rounded-2xl bg-card/80 border border-border hover:border-primary/40 transition-colors shadow-xs"
                            >
                                <div className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <span className="text-sm text-foreground font-medium leading-relaxed">
                                    {item}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Key Deliverables */}
                {deliverables.length > 0 && (
                    <div className="mb-14 space-y-6">
                        <div className="border-b border-border pb-4">
                            <span className="text-xs font-mono text-primary uppercase tracking-widest block mb-1">
                                Tangible Outputs
                            </span>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground uppercase tracking-tight">
                                Key Deliverables
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {deliverables.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border text-sm text-foreground font-mono"
                                >
                                    <PackageCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Guarantee Banner */}
                <div className="mb-14 p-6 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-foreground text-sm">Enterprise Guarantees by Default</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Mutual NDA signed before technical discovery. 100% IP rights transferred immediately upon delivery.
                            </p>
                        </div>
                    </div>
                    <span className="text-[11px] font-mono text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 shrink-0">
                        Zero Vendor Lock-In
                    </span>
                </div>

                {/* Bottom Call to Action */}
                <div className="rounded-3xl border border-border bg-card/90 backdrop-blur-xl p-8 sm:p-12 text-center space-y-6 shadow-2xl">
                    <span className="text-xs font-mono text-primary uppercase tracking-widest block">
                        Ready To Architect?
                    </span>
                    <h3 className="text-3xl sm:text-4xl font-extrabold text-foreground uppercase tracking-tight max-w-xl mx-auto">
                        Avail {service.title} Today
                    </h3>
                    <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
                        Submit a brief scope intake to receive an architectural estimate and kickoff proposal within 24 hours.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                        <Button
                            asChild
                            size="lg"
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full px-8 shadow-md"
                        >
                            <Link href={`/portal/request-proposal?serviceId=${encodeURIComponent(service.id)}`}>
                                Avail This Service <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        <Button
                            asChild
                            size="lg"
                            variant="outline"
                            className="border-border hover:bg-muted text-foreground font-semibold rounded-full px-8 bg-transparent"
                        >
                            <Link href="/contact">
                                <MessageSquare className="mr-2 h-4 w-4" /> Contact Us
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
