import { db } from "@/db";
import { siteSettings, users, aboutValues } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { BentoIcon } from "@/features/cms/about/components/BentoIcon";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal, RevealList, RevealItem } from "@/components/ui/scroll-reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { 
    ArrowRight, 
    ArrowUpRight,
    CheckCircle2, 
    Sparkles, 
    Quote, 
    Layers, 
    Cpu, 
    ShieldCheck, 
    Zap, 
    BarChart3, 
    Users, 
    Terminal, 
    Code2, 
    Workflow, 
    Rocket, 
    ExternalLink 
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Team, { TeamMemberItem } from "@/components/ui/team-02";

export const dynamic = 'force-dynamic';

export default async function AboutPage() {
    // Parallel Fetching
    const [settings, dbValues, teamFromDb] = await Promise.all([
        db.query.siteSettings.findFirst(),
        db.query.aboutValues.findMany({ orderBy: [asc(aboutValues.order)] }),
        db.query.users.findMany({ where: eq(users.showOnAboutPage, true) })
    ]);

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
            tag: "#ZERO-TECH-DEBT"
        },
        {
            id: "2",
            title: "Velocitous Execution",
            description: "Continuous integration, transparent milestone tracking, and rapid iteration loops that convert strategy into production code.",
            icon: "Zap",
            tag: "#CONTINUOUS-DELIVERY"
        },
        {
            id: "3",
            title: "Data-Driven Results",
            description: "Every UI component, server workflow, and database schema is crafted to maximize user engagement and business growth.",
            icon: "BarChart3",
            tag: "#PERFORMANCE-METRICS"
        },
        {
            id: "4",
            title: "Uncompromising Transparency",
            description: "Real-time client portals, stakeholder review loops, and complete visibility into project status at every phase.",
            icon: "Users",
            tag: "#STAKEHOLDER-PORTAL"
        }
    ];

    // Mapped Team Members for Team Component
    const mappedTeam: TeamMemberItem[] = (teamFromDb && teamFromDb.length > 0)
        ? teamFromDb.map(u => ({
            id: u.id,
            name: u.name || "Optrizo Specialist",
            role: u.jobTitle || "Engineering Team",
            image: u.image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600",
            socials: u.linkedInUrl ? [
                { platform: "linkedin" as const, link: u.linkedInUrl }
            ] : undefined
        }))
        : [
            {
                id: "1",
                name: "Alex Vance",
                role: "Founder & Principal Architect",
                image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600",
                socials: [
                    { platform: "linkedin" as const, link: "#" },
                    { platform: "twitter" as const, link: "#" },
                    { platform: "website" as const, link: "#" },
                ]
            },
            {
                id: "2",
                name: "Elena Rostova",
                role: "Head of Product & Design",
                image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=600",
                socials: [
                    { platform: "instagram" as const, link: "#" },
                    { platform: "dribbble" as const, link: "#" },
                    { platform: "linkedin" as const, link: "#" },
                ]
            },
            {
                id: "3",
                name: "Marcus Chen",
                role: "Lead Full-Stack Engineer",
                image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=600",
                socials: [
                    { platform: "linkedin" as const, link: "#" },
                    { platform: "twitter" as const, link: "#" },
                ]
            },
            {
                id: "4",
                name: "Sarah Jenkins",
                role: "VP of Client Success",
                image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=600",
                socials: [
                    { platform: "linkedin" as const, link: "#" },
                    { platform: "website" as const, link: "#" },
                ]
            }
        ];

    // Execution Lifecycle Steps
    const executionPillars = [
        {
            num: "01",
            title: "Domain Architecture & Scoping",
            subtitle: "Discovery & Blueprinting",
            description: "Deep dive into business requirements, database entity relationships, security boundaries, and technical specifications.",
            icon: Terminal,
            badge: "PHASE 01"
        },
        {
            num: "02",
            title: "Tactile UX & Interactive Systems",
            subtitle: "Cyber-Minimalist Design",
            description: "Crafting modular design systems, accessible UI components, and fluid micro-interactions validated through interactive prototypes.",
            icon: Layers,
            badge: "PHASE 02"
        },
        {
            num: "03",
            title: "Full-Stack Type-Safe Engineering",
            subtitle: "Next.js 16 & Reactive Logic",
            description: "Modular full-stack development with React 19, server actions, PostgreSQL migrations, and automated quality gates.",
            icon: Code2,
            badge: "PHASE 03"
        },
        {
            num: "04",
            title: "Continuous Validation & Rollout",
            subtitle: "Zero-Downtime Deployment",
            description: "Automated CI/CD pipelines, live telemetry tracking, client acceptance loops, and high-availability cloud infrastructure.",
            icon: Rocket,
            badge: "PHASE 04"
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
            <section className="relative py-12 lg:py-20 rounded-3xl overflow-hidden">
                {/* Static Architectural Grid Matrix Background */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

                {/* Ambient Radial Electric Green Glow Overlay */}
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-primary/10 dark:bg-primary/15 blur-[130px] rounded-full pointer-events-none" />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
                    
                    {/* Left Column: Studio Manifesto */}
                    <div className="lg:col-span-7 space-y-6 text-left">
                        {/* Top Cyber Telemetry Badge */}
                        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-border/80 bg-card/60 dark:bg-card/40 backdrop-blur-md shadow-xs">
                            <div className="w-2 h-2 rounded-full bg-[#00D639] shadow-[0_0_8px_#00D639]" />
                            <span className="font-mono text-[11px] font-bold tracking-[0.2em] uppercase text-foreground">
                                OPTRIZO <span className="text-primary font-bold">{" // "}</span>STUDIO MANIFESTO <span className="text-primary font-bold">{" // "}</span>01
                            </span>
                        </div>

                        {/* High-Impact Headline */}
                        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight text-foreground leading-[0.95]">
                            Architecting <br />
                            <span className="text-primary text-glow">Digital Systems</span>
                        </h1>

                        {/* Mono Subtitle */}
                        <div className="space-y-2">
                            <p className="font-mono text-xs font-bold tracking-[0.22em] uppercase text-foreground">
                                FULL-STACK SOFTWARE STUDIO <span className="text-primary">{" // "}</span>SCALABLE INFRASTRUCTURE
                            </p>
                            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground leading-relaxed">
                                {settings?.aboutHeroTitle || "Engineering High-Performance Digital Products For Forward-Thinking Enterprises."}
                            </p>
                        </div>

                        {/* Manifesto Quote Panel */}
                        <div className="glass-card border border-border/80 dark:border-white/10 rounded-2xl p-6 sm:p-7 relative shadow-sm">
                            <Quote className="w-6 h-6 text-primary/40 mb-3" />
                            <p className="text-base sm:text-lg text-foreground font-normal leading-relaxed">
                                &quot;{settings?.missionStatement || "Optrizo is a full-service software studio. We combine modern technical architecture, high-converting UX design, and robust project workflows to transform ambitious ideas into enterprise digital assets."}&quot;
                            </p>
                        </div>

                        {/* Magnetic CTA Row */}
                        <div className="pt-2 flex flex-wrap items-center gap-6">
                            <Link
                                href="/contact"
                                className="group flex items-center gap-4 cursor-pointer"
                            >
                                <div className="w-12 h-12 rounded-full border border-border/80 bg-card flex items-center justify-center transition-all duration-300 group-hover:border-primary group-hover:bg-primary group-hover:shadow-[0_0_25px_rgba(0,214,57,0.4)]">
                                    <ArrowUpRight className="w-5 h-5 text-foreground group-hover:text-black transition-colors" />
                                </div>
                                <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-foreground group-hover:text-primary transition-colors">
                                    Start a Project
                                </span>
                            </Link>

                            <Link
                                href="#principles"
                                className="px-5 py-2.5 rounded-full border border-border/80 bg-card/50 text-xs font-mono tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all backdrop-blur-md"
                            >
                                Explore Principles
                            </Link>
                        </div>
                    </div>

                    {/* Right Column: Studio Command Deck */}
                    <div className="lg:col-span-5 flex flex-col gap-4">
                        {/* Command Cell 01: Availability */}
                        <div className="glass-card border border-border/80 dark:border-white/10 rounded-2xl p-6 sm:p-7 transition-all duration-300 hover:border-primary/40 shadow-xs">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-2">
                                01 <span className="text-primary font-bold">{" // "}</span>STUDIO AVAILABILITY
                            </span>
                            <div className="flex justify-between items-end mt-2">
                                <h4 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                    Q3-Q4 Open
                                    <span className="inline-block w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" />
                                </h4>
                                <div className="h-[2px] w-24 rounded-full overflow-hidden bg-muted/40">
                                    <div className="h-full w-[75%] bg-primary" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 font-mono">
                                Accepting new projects & architectural retainers.
                            </p>
                        </div>

                        {/* Command Cell 02: Performance Metrics */}
                        <div className="glass-card border border-border/80 dark:border-white/10 rounded-2xl p-6 sm:p-7 transition-all duration-300 hover:border-primary/40 shadow-xs">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-3">
                                02 <span className="text-primary font-bold">{" // "}</span>OPERATIONAL BENCHMARK
                            </span>
                            <div className="flex flex-col gap-2.5 text-xs font-mono">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Production Uptime SLA</span>
                                    <span className="text-primary font-bold">99.99%</span>
                                </div>
                                <div className="h-[1px] w-full bg-border/60 dark:bg-white/10" />
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Average Client ROI</span>
                                    <span className="text-primary font-bold">3.5x Increase</span>
                                </div>
                            </div>
                        </div>

                        {/* Command Cell 03: Core Tenet */}
                        <div className="glass-card border border-border/80 dark:border-white/10 rounded-2xl p-6 sm:p-7 transition-all duration-300 hover:border-primary/40 shadow-xs">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-2">
                                03 <span className="text-primary font-bold">{" // "}</span>CORE CAPABILITY
                            </span>
                            <p className="text-sm font-medium text-foreground leading-snug">
                                Transforming complex enterprise workflows into{" "}
                                <span className="text-primary font-bold">high-velocity digital platforms</span>.
                            </p>
                        </div>
                    </div>

                </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION 2: TELEMETRY METRICS DECK                              */}
            {/* ============================================================== */}
            <section className="py-8">
                <div className="relative glass-card border border-border/80 dark:border-white/10 rounded-3xl p-8 sm:p-12 shadow-sm backdrop-blur-xl overflow-hidden">
                    <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-border/60 dark:divide-white/10">
                        {stats.map((stat, i) => (
                            <div key={i} className="flex flex-col items-center justify-center p-4">
                                <span className="text-4xl sm:text-5xl lg:text-6xl font-mono font-extrabold text-primary tracking-tight text-glow-sm">
                                    {stat.value}
                                </span>
                                <span className="text-xs sm:text-sm font-mono tracking-widest uppercase text-muted-foreground font-semibold mt-3">
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
                <ScrollReveal className="text-center mb-16 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10">
                        <span className="font-mono text-xs font-bold tracking-widest text-primary uppercase">
                            02 <span className="opacity-60">{" // "}</span>ENGINEERING DNA
                        </span>
                    </div>
                    <SectionHeading text="Engineered For Excellence" className="text-3xl sm:text-5xl" />
                    <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
                        The architectural tenets and operational standards driving every platform we build.
                    </p>
                </ScrollReveal>

                <RevealList className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[270px] max-w-6xl mx-auto">
                    {values.map((val: any, i) => (
                        <RevealItem key={val.id} className={`${getBentoClasses(i, values.length)}`}>
                            <div 
                                className="h-full glass-card border border-border/70 dark:border-white/10 hover:border-primary/50 transition-all duration-300 rounded-3xl p-8 flex flex-col items-start justify-between group relative overflow-hidden backdrop-blur-md shadow-xs hover:shadow-[0_0_30px_rgba(0,214,57,0.12)]"
                            >
                                <div className="w-full flex items-center justify-between relative z-10">
                                    <div className="p-3.5 bg-primary/10 border border-primary/20 text-primary rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                                        <BentoIcon name={val.icon || "Zap"} className="h-6 w-6 stroke-[2px]" />
                                    </div>
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-primary/80 font-bold bg-primary/5 border border-primary/20 px-2.5 py-1 rounded-full">
                                        {val.tag || `PRINCIPLE // 0${i + 1}`}
                                    </span>
                                </div>

                                <div className="relative z-10 mt-4">
                                    <h3 className={`font-bold text-foreground mb-3 group-hover:text-primary transition-colors ${i === 0 ? "text-2xl sm:text-3xl" : "text-xl"}`}>
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
                <ScrollReveal className="text-center mb-16 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10">
                        <span className="font-mono text-xs font-bold tracking-widest text-primary uppercase">
                            03 <span className="opacity-60">{" // "}</span>METHODOLOGY
                        </span>
                    </div>
                    <SectionHeading text="How We Build Systems" className="text-3xl sm:text-5xl" />
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
                                className="group glass-card border border-border/80 dark:border-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-primary/50 transition-all duration-300 shadow-xs hover:shadow-[0_0_25px_rgba(0,214,57,0.12)] relative overflow-hidden"
                            >
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-xs font-extrabold text-primary">
                                            {pillar.badge}
                                        </span>
                                        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                                            {pillar.title}
                                        </h4>
                                        <span className="font-mono text-[10px] uppercase tracking-wider text-primary/80 block mt-0.5">
                                            {pillar.subtitle}
                                        </span>
                                    </div>

                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {pillar.description}
                                    </p>
                                </div>

                                <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                                    <span>MILESTONE</span>
                                    <span className="text-foreground font-bold">{pillar.num} {" / 04"}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION 5: LEADERSHIP & SPECIALISTS (21st.dev team-02)        */}
            {/* ============================================================== */}
            <div className="border-t border-border/60">
                <Team 
                    badge="04 // SPECIALISTS"
                    title="Meet The Experts"
                    subtitle="The engineers, product designers, and technical strategists crafting next-generation digital products at Optrizo."
                    members={mappedTeam}
                />
            </div>

            {/* ============================================================== */}
            {/* SECTION 6: ENTERPRISE TECH STACK & ECOSYSTEM (Magic UI Pills)  */}
            {/* ============================================================== */}
            <section id="tech-stack" className="py-20 border-t border-border/60 text-center">
                <ScrollReveal className="space-y-4 mb-12">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10">
                        <span className="font-mono text-xs font-bold tracking-widest text-primary uppercase">
                            05 <span className="opacity-60">{" // "}</span>ECOSYSTEM
                        </span>
                    </div>
                    <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                        {settings?.aboutTechStack || "Enterprise Technologies & Infrastructure"}
                    </h3>
                    <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
                        Engineered on modern, battle-tested tools selected for peak execution speed and reliability.
                    </p>
                </ScrollReveal>

                <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-5 max-w-5xl mx-auto">
                    {techItems.map((tech, i) => (
                        <div 
                            key={i} 
                            className="flex items-center gap-3 px-5 py-3 glass-card border border-border/80 dark:border-white/10 rounded-2xl text-foreground font-bold text-sm tracking-tight hover:border-primary/50 hover:text-primary transition-all backdrop-blur-md shadow-xs group"
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
                                <CheckCircle2 className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                            )}
                            <div className="flex flex-col text-left">
                                <span className="leading-none">{tech.name}</span>
                                {tech.category && (
                                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground group-hover:text-primary/70 mt-1">
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
                <div className="relative bg-gradient-to-b from-primary/10 via-card to-card dark:from-primary/10 dark:via-black/75 dark:to-black/90 border border-primary/30 rounded-3xl p-10 sm:p-16 max-w-4xl mx-auto text-center shadow-lg dark:shadow-[0_0_60px_rgba(57,255,20,0.1)] overflow-hidden">
                    <div className="absolute top-0 right-0 w-72 h-72 bg-primary/20 blur-[110px] rounded-full pointer-events-none" />

                    <div className="relative z-10 space-y-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10">
                            <span className="font-mono text-[10px] font-bold tracking-widest text-primary uppercase">
                                INITIALIZE COLLABORATION <span className="opacity-60">{" // "}</span>Q3-Q4 SLOTS AVAILABLE
                            </span>
                        </div>

                        <h2 className="text-3xl sm:text-5xl font-extrabold text-foreground tracking-tight max-w-2xl mx-auto">
                            {settings?.aboutCtaHeadline || "Ready to architect your next digital asset?"}
                        </h2>

                        <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                            {settings?.aboutCtaText || "We partner with ambitious enterprises and startups to transform bold visions into high-velocity digital realities."}
                        </p>

                        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link 
                                href="/contact" 
                                className="inline-flex items-center justify-center h-14 px-8 text-base font-bold text-black bg-primary rounded-xl hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/40 group w-full sm:w-auto"
                            >
                                Schedule a Consultation <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link 
                                href="/portal/services" 
                                className="inline-flex items-center justify-center h-14 px-8 text-base font-semibold text-foreground bg-background/60 border border-border rounded-xl hover:bg-muted/50 hover:border-primary/40 dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10 transition-all w-full sm:w-auto"
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
