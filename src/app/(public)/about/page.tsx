import { db } from "@/db";
import { aboutValues } from "@/db/schema";
import { asc } from "drizzle-orm";
import { getPublishedPage } from "@/features/cms/content/public-queries";
import type { AboutFields } from "@/features/cms/content/schemas";
import { BentoIcon } from "@/features/cms/about/components/BentoIcon";
import { ScrollReveal, RevealList, RevealItem } from "@/components/ui/scroll-reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import {
    ArrowRight,
    ArrowUpRight,
    CheckCircle2,
    Quote,
    Layers,
    Terminal,
    Code2,
    Rocket,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Team, { TeamMemberItem } from "@/components/ui/team-02";

export const revalidate = 3600; // Cache and revalidate every hour (ISR)

export default async function AboutPage() {
    // Parallel Fetching
    const [settings, dbValues, aboutPage] = await Promise.all([
        db.query.siteSettings.findFirst(),
        db.query.aboutValues.findMany({ orderBy: [asc(aboutValues.order)] }),
        getPublishedPage("about"),
    ]);

    const fields = aboutPage?.fields as AboutFields | undefined;

    // Parse Stats JSON safely or use robust defaults
    let stats: { label: string, value: string }[] = [];
    if (settings?.companyStats) {
        if (Array.isArray(settings.companyStats)) {
            stats = settings.companyStats;
        } else if (typeof settings.companyStats === 'string') {
            try { stats = JSON.parse(settings.companyStats); } catch {}
        }
    }
    if (!stats || stats.length === 0) {
        stats = [
            { label: "Projects Delivered", value: "150+" },
            { label: "Client Satisfaction", value: "99.4%" },
            { label: "Avg. ROI Increase", value: "3.5x" },
            { label: "Production Uptime", value: "99.99%" },
        ];
    }

    // Parse Tech Stack JSON safely or use defaults
    let techItems: { name: string; category?: string; imageUrl?: string; iconUrl?: string }[] = [];
    if (settings?.aboutTechStackItems) {
        if (Array.isArray(settings.aboutTechStackItems)) {
            techItems = settings.aboutTechStackItems;
        } else if (typeof settings.aboutTechStackItems === 'string') {
            try { techItems = JSON.parse(settings.aboutTechStackItems); } catch {}
        }
    }
    if (!techItems || techItems.length === 0) {
        techItems = [
            { name: "Next.js 16", category: "Core Framework" },
            { name: "React 19", category: "Reactive UI" },
            { name: "TypeScript", category: "Type Safety" },
            { name: "PostgreSQL", category: "Database" },
            { name: "Drizzle ORM", category: "Data Layer" },
            { name: "Tailwind CSS", category: "Design System" },
            { name: "Three.js / R3F", category: "3D Motion" },
            { name: "Docker & Cloud", category: "Infrastructure" },
        ];
    }

    // Core Values Fallback
    const values = (dbValues && dbValues.length > 0) ? dbValues : [
        {
            id: "1",
            title: "Architectural Rigor",
            description: "We engineer clean, modular, and type-safe systems designed to scale seamlessly without accumulating technical debt.",
            icon: "ShieldCheck",
            tag: "Zero tech debt"
        },
        {
            id: "2",
            title: "Velocitous Execution",
            description: "Continuous integration, transparent milestone tracking, and rapid iteration loops that convert strategy into production code.",
            icon: "Zap",
            tag: "Continuous delivery"
        },
        {
            id: "3",
            title: "Data-Driven Results",
            description: "Every UI component, server workflow, and database schema is crafted to maximize user engagement and business growth.",
            icon: "BarChart3",
            tag: "Measured results"
        },
        {
            id: "4",
            title: "Uncompromising Transparency",
            description: "Real-time client portals, stakeholder review loops, and complete visibility into project status at every phase.",
            icon: "Users",
            tag: "Client portal"
        }
    ];

    // Mapped Team Members from CMS
    const teamCards = fields?.team || [];
    const mappedTeam: TeamMemberItem[] = teamCards.map((u, idx) => ({
        id: String(idx + 1),
        name: u.name,
        role: u.jobTitle,
        image: u.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600",
    }));

    // Execution Lifecycle Steps
    const executionPillars = [
        {
            num: "01",
            title: "Domain Architecture & Scoping",
            subtitle: "Discovery & Blueprinting",
            description: "Deep dive into business requirements, database entity relationships, security boundaries, and technical specifications.",
            icon: Terminal,
            badge: "Phase 1"
        },
        {
            num: "02",
            title: "Tactile UX & Interactive Systems",
            subtitle: "Cyber-Minimalist Design",
            description: "Crafting modular design systems, accessible UI components, and fluid micro-interactions validated through interactive prototypes.",
            icon: Layers,
            badge: "Phase 2"
        },
        {
            num: "03",
            title: "Full-Stack Type-Safe Engineering",
            subtitle: "Next.js 16 & Reactive Logic",
            description: "Modular full-stack development with React 19, server actions, PostgreSQL migrations, and automated quality gates.",
            icon: Code2,
            badge: "Phase 3"
        },
        {
            num: "04",
            title: "Continuous Validation & Rollout",
            subtitle: "Zero-Downtime Deployment",
            description: "Automated CI/CD pipelines, live telemetry tracking, client acceptance loops, and high-availability cloud infrastructure.",
            icon: Rocket,
            badge: "Phase 4"
        }
    ];

    // Dynamic Bento Grid Layout helper
    const getBentoClasses = (i: number, total: number) => {
        if (total === 1) return "md:col-span-3 md:row-span-2";
        if (total === 2) return i === 0 ? "md:col-span-2 md:row-span-2" : "md:col-span-1 md:row-span-2";
        if (total === 3) return i === 0 ? "md:col-span-2 md:row-span-2" : "md:col-span-1 md:row-span-1";
        if (i === 0) return "md:col-span-2 md:row-span-2";
        return "md:col-span-1 md:row-span-1";
    };

    return (
        <div className="relative z-10 w-full max-w-[1400px] mx-auto pt-20 pb-32 px-4 sm:px-6 overflow-hidden">

            {/* ============================================================== */}
            {/* SECTION 1: CYBER-MINIMALIST HERO & COMMAND DECK               */}
            {/* ============================================================== */}
            <section className="relative py-12 lg:py-20 rounded-2xl overflow-hidden">
                {/* Decorative background (kept on request): faint grid and a soft brand-green glow. */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

                {/* Ambient Radial Electric Green Glow Overlay */}
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-primary/10 dark:bg-primary/15 blur-[130px] rounded-full pointer-events-none" />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
                    
                    {/* Left Column: Studio Manifesto */}
                    <div className="lg:col-span-7 space-y-6 text-left">
                        {/* Top Cyber Telemetry Badge */}
                        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-border bg-card/60 dark:bg-card/40">
                            <div className="size-2 rounded-full bg-brand-deep" />
                            <span className="text-xs font-semibold text-foreground">
                                About Optrizo
                            </span>
                        </div>

                        {/* High-Impact Headline */}
                        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-foreground leading-[0.95]">
                            Architecting <br />
                            <span className="text-brand-deep">Digital Systems</span>
                        </h1>

                        {/* Mono Subtitle */}
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-foreground">
                                Full-stack software studio
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                                {fields?.heading || "Engineering High-Performance Digital Products For Forward-Thinking Enterprises."}
                            </p>
                        </div>

                        {/* Manifesto Quote Panel (Mission) */}
                        {fields?.mission?.trim() && (
                            <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 relative">
                                <Quote className="w-6 h-6 text-brand-deep mb-3" />
                                <span className="text-xs text-brand-deep font-semibold block mb-2">
                                    Mission
                                </span>
                                <p className="text-base sm:text-lg text-foreground font-normal leading-relaxed whitespace-pre-line">
                                    &quot;{fields?.mission?.trim()}&quot;
                                </p>
                            </div>
                        )}

                        {/* Story Panel */}
                        {fields?.story?.trim() && (
                            <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 relative space-y-2">
                                <span className="text-xs text-brand-deep font-semibold block">
                                    Our story
                                </span>
                                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-line">
                                    {fields.story}
                                </p>
                            </div>
                        )}

                        {/* Vision Panel */}
                        {fields?.vision?.trim() && (
                            <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 relative space-y-2">
                                <span className="text-xs text-brand-deep font-semibold block">
                                    Vision
                                </span>
                                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-line">
                                    {fields.vision}
                                </p>
                            </div>
                        )}

                        {/* How We Work Panel */}
                        {fields?.howWeWork?.trim() && (
                            <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 relative space-y-2">
                                <span className="text-xs text-brand-deep font-semibold block">
                                    How we work
                                </span>
                                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-line">
                                    {fields.howWeWork}
                                </p>
                            </div>
                        )}

                        {/* Magnetic CTA Row */}
                        <div className="pt-2 flex flex-wrap items-center gap-6">
                            <Link
                                href="/contact"
                                className="group flex items-center gap-4 cursor-pointer"
                            >
                                <div className="w-12 h-12 rounded-full border border-border bg-card flex items-center justify-center transition-colors duration-300 group-hover:border-primary group-hover:bg-primary group-">
                                    <ArrowUpRight className="w-5 h-5 text-foreground group-hover:text-primary-foreground transition-colors" />
                                </div>
                                <span className="text-xs font-semibold text-foreground group-hover:text-brand-deep transition-colors">
                                    Start a Project
                                </span>
                            </Link>

                            <Link
                                href="#principles"
                                className="px-5 py-2.5 rounded-full border border-border bg-card/50 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors "
                            >
                                Explore Principles
                            </Link>
                        </div>
                    </div>

                    {/* Right Column: Studio Command Deck */}
                    <div className="lg:col-span-5 flex flex-col gap-4">
                        {/* Command Cell 01: Availability */}
                        <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 transition-colors duration-300 hover:border-foreground/20">
                            <span className="text-xs text-muted-foreground block mb-2">
                                Availability
                            </span>
                            <div className="flex justify-between items-end mt-2">
                                <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                                    Q3-Q4 Open
                                    <span className="inline-block size-2 rounded-full bg-brand-deep" />
                                </p>
                                <div className="h-[2px] w-24 rounded-full overflow-hidden bg-muted/40">
                                    <div className="h-full w-[75%] bg-primary" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                                Accepting new projects & architectural retainers.
                            </p>
                        </div>

                        {/* Command Cell 02: Performance Metrics */}
                        <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 transition-colors duration-300 hover:border-foreground/20">
                            <span className="text-xs text-muted-foreground block mb-3">
                                How we measure work
                            </span>
                            <div className="flex flex-col gap-2.5 text-xs tabular-nums">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Production Uptime SLA</span>
                                    <span className="text-brand-deep font-semibold">99.99%</span>
                                </div>
                                <div className="h-[1px] w-full bg-border/60" />
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Average Client ROI</span>
                                    <span className="text-brand-deep font-semibold">3.5x Increase</span>
                                </div>
                            </div>
                        </div>

                        {/* Command Cell 03: Core Tenet */}
                        <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 transition-colors duration-300 hover:border-foreground/20">
                            <span className="text-xs text-muted-foreground block mb-2">
                                What we do best
                            </span>
                            <p className="text-sm font-medium text-foreground leading-snug">
                                Transforming complex enterprise workflows into{" "}
                                <span className="text-brand-deep font-semibold">high-velocity digital platforms</span>.
                            </p>
                        </div>
                    </div>

                </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION 2: TELEMETRY METRICS DECK                              */}
            {/* ============================================================== */}
            <section className="py-8">
                <div className="relative bg-card border border-border rounded-2xl p-8 sm:p-12 overflow-hidden">
                    <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-border/60">
                        {stats.map((stat, i) => (
                            <div key={i} className="flex flex-col items-center justify-center p-4">
                                <span className="text-4xl sm:text-5xl lg:text-6xl font-semibold tabular-nums text-brand-deep tracking-tight">
                                    {stat.value}
                                </span>
                                <span className="text-xs sm:text-sm text-muted-foreground font-semibold mt-3">
                                    {stat.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION 3: CORE VALUES & BENTO GRID                            */}
            {/* ============================================================== */}
            <section id="principles" className="py-24 border-t border-border/60 mt-12">
                <ScrollReveal className="mb-12 flex flex-col items-center gap-3 text-center sm:mb-16">
                    <div className="mb-1 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10">
                        <span className="text-xs font-semibold text-brand-deep ">
                            Our principles
                        </span>
                    </div>
                    <SectionHeading text="Engineered for excellence" className="text-3xl sm:text-4xl" />
                    <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
                        The architectural tenets and operational standards driving every platform we build.
                    </p>
                </ScrollReveal>

                <RevealList className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[270px] max-w-6xl mx-auto">
                    {values.map((val: any, i) => (
                        <RevealItem key={val.id} className={`${getBentoClasses(i, values.length)}`}>
                            <div 
                                className="h-full bg-card border border-border hover:border-foreground/20 transition-colors duration-300 rounded-2xl p-8 flex flex-col items-start justify-between group relative overflow-hidden"
                            >
                                <div className="w-full flex items-center justify-between relative z-10">
                                    <div className="p-3.5 bg-primary/10 border border-primary/20 text-brand-deep rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                                        <BentoIcon name={val.icon || "Zap"} className="h-6 w-6 stroke-[2px]" />
                                    </div>
                                    <span className="text-xs text-brand-deep font-semibold bg-brand-soft px-2.5 py-1 rounded-full">
                                        {val.tag || `Principle ${i + 1}`}
                                    </span>
                                </div>

                                <div className="relative z-10 mt-4">
                                    <h3 className={`font-semibold text-foreground mb-3 ${i === 0 ? "text-2xl sm:text-3xl" : "text-xl"}`}>
                                        {val.title}
                                    </h3>
                                    <p className={`text-muted-foreground leading-relaxed ${i === 0 ? "text-base sm:text-lg" : "text-sm"}`}>
                                        {val.description}
                                    </p>
                                </div>
                            </div>
                        </RevealItem>
                    ))}
                </RevealList>
            </section>

            {/* ============================================================== */}
            {/* SECTION 4: EXECUTION LIFECYCLE (21st.dev Timeline-01)          */}
            {/* ============================================================== */}
            <section className="py-24 border-t border-border/60">
                <ScrollReveal className="mb-12 flex flex-col items-center gap-3 text-center sm:mb-16">
                    <div className="mb-1 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10">
                        <span className="text-xs font-semibold text-brand-deep ">
                            How we work
                        </span>
                    </div>
                    <SectionHeading text="How we build systems" className="text-3xl sm:text-4xl" />
                    <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
                        A systematic, type-safe lifecycle engineered to eliminate surprises and maximize delivery velocity.
                    </p>
                </ScrollReveal>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                    {executionPillars.map((pillar, idx) => {
                        const Icon = pillar.icon;
                        return (
                            <div 
                                key={idx}
                                className="group bg-card border border-border rounded-2xl p-6 flex flex-col justify-between hover:border-foreground/20 transition-colors duration-300 relative overflow-hidden"
                            >
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-brand-deep">
                                            {pillar.badge}
                                        </span>
                                        <div className="p-2 rounded-xl bg-primary/10 text-brand-deep border border-primary/20">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-foreground">
                                            {pillar.title}
                                        </h3>
                                        <span className="text-xs text-brand-deep block mt-0.5">
                                            {pillar.subtitle}
                                        </span>
                                    </div>

                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {pillar.description}
                                    </p>
                                </div>

                                <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Milestone</span>
                                    <span className="text-foreground font-semibold">{pillar.num} {" / 04"}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION 5: LEADERSHIP & SPECIALISTS (21st.dev team-02)        */}
            {/* ============================================================== */}
            {mappedTeam.length > 0 && (
                <div className="border-t border-border/60">
                    <Team 
                        badge="Our team"
                        title="Meet the team"
                        subtitle="The engineers, product designers, and technical strategists crafting next-generation digital products at Optrizo."
                        members={mappedTeam}
                    />
                </div>
            )}

            {/* ============================================================== */}
            {/* SECTION 6: ENTERPRISE TECH STACK & ECOSYSTEM (Magic UI Pills)  */}
            {/* ============================================================== */}
            <section id="tech-stack" className="py-20 border-t border-border/60 text-center">
                <ScrollReveal className="mb-12 flex flex-col items-center gap-3 text-center">
                    <div className="mb-1 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10">
                        <span className="text-xs font-semibold text-brand-deep ">
                            Tools we use
                        </span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground [text-wrap:balance]">
                        {settings?.aboutTechStack || "Enterprise technologies and infrastructure"}
                    </h2>
                    <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
                        Engineered on modern, battle-tested tools selected for peak execution speed and reliability.
                    </p>
                </ScrollReveal>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-4xl mx-auto">
                    {techItems.map((tech, i) => (
                        <div 
                            key={i} 
                            className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl text-foreground font-semibold text-sm hover:border-foreground/20 transition-colors group"
                        >
                            {tech.imageUrl ? (
                                <div className="relative w-5 h-5">
                                    <Image
                                        src={tech.imageUrl}
                                        alt={tech.name}
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                            ) : (
                                <CheckCircle2 className="w-4 h-4 text-brand-deep group-hover:scale-110 transition-transform" />
                            )}
                            <div className="flex flex-col text-left">
                                <span className="leading-none">{tech.name}</span>
                                {tech.category && (
                                    <span className="text-xs font-normal text-muted-foreground mt-1">
                                        {tech.category}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION 7: STUDIO COMMAND DECK CTA                             */}
            {/* ============================================================== */}
            <section className="py-24 border-t border-border/60">
                <div className="relative bg-brand-soft/60 rounded-2xl p-10 sm:p-16 max-w-4xl mx-auto text-center overflow-hidden">
                    <div className="absolute top-0 right-0 w-72 h-72 bg-primary/20 blur-[110px] rounded-full pointer-events-none" />

                    <div className="relative z-10 space-y-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10">
                            <span className="text-xs font-semibold text-brand-deep ">
                                Start a project
                            </span>
                        </div>

                        <h2 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight max-w-2xl mx-auto">
                            {settings?.aboutCtaHeadline || "Ready to architect your next digital asset?"}
                        </h2>

                        <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                            {settings?.aboutCtaText || "We partner with ambitious enterprises and startups to transform bold visions into high-velocity digital realities."}
                        </p>

                        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link 
                                href="/contact" 
                                className="inline-flex items-center justify-center h-14 px-8 text-base font-semibold text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-colors hover:shadow-primary/40 group w-full sm:w-auto"
                            >
                                Schedule a Consultation <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link 
                                href="/portal/services" 
                                className="inline-flex items-center justify-center h-14 px-8 text-base font-semibold text-foreground bg-background/60 border border-border rounded-xl hover:bg-muted/50 hover:border-foreground/20 transition-colors w-full sm:w-auto"
                            >
                                Explore Our Services
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

        </div>
    );
}
