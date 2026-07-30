import { db } from "@/db";
import { siteSettings, users, aboutValues } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BentoIcon } from "@/features/cms/about/components/BentoIcon";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal, RevealList, RevealItem } from "@/components/ui/scroll-reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

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
        try { stats = JSON.parse(settings.companyStats); } catch {}
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
    let techItems: { name: string, imageUrl: string }[] = [];
    if (settings?.aboutTechStackItems) {
        try { techItems = JSON.parse(settings.aboutTechStackItems); } catch {}
    }
    if (!techItems || techItems.length === 0) {
        techItems = [
            { name: "Next.js 16", imageUrl: "" },
            { name: "React 19", imageUrl: "" },
            { name: "TypeScript", imageUrl: "" },
            { name: "PostgreSQL", imageUrl: "" },
            { name: "Drizzle ORM", imageUrl: "" },
            { name: "Tailwind CSS", imageUrl: "" },
        ];
    }

    // Core Values Fallback
    const values = (dbValues && dbValues.length > 0) ? dbValues : [
        {
            id: "1",
            title: "Architectural Rigor",
            description: "We engineer clean, modular, and type-safe systems designed to scale seamlessly without accumulating technical debt.",
            icon: "ShieldCheck"
        },
        {
            id: "2",
            title: "Velocitous Execution",
            description: "Continuous integration, transparent milestone tracking, and rapid iteration loops that convert strategy into production code.",
            icon: "Zap"
        },
        {
            id: "3",
            title: "Data-Driven Results",
            description: "Every UI component, server workflow, and database schema is crafted to maximize user engagement and business growth.",
            icon: "BarChart3"
        },
        {
            id: "4",
            title: "Uncompromising Transparency",
            description: "Real-time client portals, stakeholder review loops, and complete visibility into project status at every phase.",
            icon: "Users"
        }
    ];

    // Team Fallback
    const team = (teamFromDb && teamFromDb.length > 0) ? teamFromDb : [
        {
            id: "1",
            name: "Alex Vance",
            jobTitle: "Founder & Principal Architect",
            image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400"
        },
        {
            id: "2",
            name: "Elena Rostova",
            jobTitle: "Head of Product & Design",
            image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400"
        },
        {
            id: "3",
            name: "Marcus Chen",
            jobTitle: "Lead Full-Stack Engineer",
            image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400"
        },
        {
            id: "4",
            name: "Sarah Jenkins",
            jobTitle: "VP of Client Success",
            image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400"
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
        <div className="relative z-10 w-full max-w-[1400px] mx-auto pt-24 pb-32 px-4 sm:px-6">

            {/* Section 1: Hero & Mission */}
            <section className="relative py-16 lg:py-24 text-center">
                {/* Glow Overlay */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/15 blur-[120px] rounded-full pointer-events-none" />

                <ScrollReveal className="max-w-4xl mx-auto space-y-6">
                    <Badge variant="outline" className="px-4 py-1.5 border-primary/30 bg-primary/10 text-primary text-xs uppercase tracking-widest backdrop-blur-md">
                        <Sparkles className="w-3.5 h-3.5 mr-2 inline text-primary" />
                        About Optrizo
                    </Badge>

                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-tight">
                        {settings?.aboutHeroTitle || "Engineering High-Performance Digital Products"}
                    </h1>

                    <p className="text-lg sm:text-xl text-white/70 font-normal leading-relaxed max-w-3xl mx-auto pt-2">
                        &quot;{settings?.missionStatement || "Optrizo is a full-service software studio. We combine modern technical architecture, high-converting UX design, and robust project workflows to transform ambitious ideas into enterprise digital assets."}&quot;
                    </p>
                </ScrollReveal>
            </section>

            {/* Section 2: Company Stats */}
            <section className="py-10">
                <div className="bg-black/60 border border-white/10 rounded-3xl p-8 sm:p-12 shadow-[0_0_50px_rgba(57,255,20,0.06)] backdrop-blur-xl">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-white/10">
                        {stats.map((stat, i) => (
                            <div key={i} className={`flex flex-col items-center justify-center p-4 ${i > 0 ? 'pt-6 md:pt-4' : ''}`}>
                                <span className="text-4xl sm:text-5xl lg:text-6xl font-mono font-extrabold text-primary tracking-tight">
                                    {stat.value}
                                </span>
                                <span className="text-xs sm:text-sm tracking-wider uppercase text-white/60 font-semibold mt-3">
                                    {stat.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Section 3: Core Values (Bento Grid) */}
            <section className="py-24 border-t border-white/10 mt-12">
                <ScrollReveal className="text-center mb-16">
                    <Badge variant="secondary" className="mb-4 text-primary bg-primary/10 border border-primary/20">Our Principles</Badge>
                    <SectionHeading text="Engineered For Excellence" className="text-3xl sm:text-5xl mb-4" />
                    <p className="text-white/60 max-w-2xl mx-auto text-base sm:text-lg">
                        The core standards driving our digital craftsmanship and client partnerships.
                    </p>
                </ScrollReveal>

                <RevealList className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[260px] max-w-6xl mx-auto">
                    {values.map((val, i) => (
                        <RevealItem key={val.id} className={`${getBentoClasses(i, values.length)}`}>
                            <div className="h-full bg-black/40 border border-white/10 hover:border-primary/50 transition-all duration-300 rounded-3xl p-8 flex flex-col items-start justify-between group relative overflow-hidden backdrop-blur-md">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                <div className="p-3.5 bg-primary/10 border border-primary/20 text-primary rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                                    <BentoIcon name={val.icon || "Zap"} className="h-6 w-6 stroke-[2px]" />
                                </div>

                                <div className="relative z-10 mt-4">
                                    <h3 className={`font-bold text-white mb-3 group-hover:text-primary transition-colors ${i === 0 ? "text-2xl sm:text-3xl" : "text-xl"}`}>
                                        {val.title}
                                    </h3>
                                    <p className={`text-white/70 leading-relaxed ${i === 0 ? "text-base sm:text-lg" : "text-sm"}`}>
                                        {val.description}
                                    </p>
                                </div>
                            </div>
                        </RevealItem>
                    ))}
                </RevealList>
            </section>

            {/* Section 4: The Team Grid */}
            <section className="py-24 border-t border-white/10">
                <ScrollReveal className="text-center mb-16">
                    <Badge variant="secondary" className="mb-4 text-primary bg-primary/10 border border-primary/20">Leadership & Team</Badge>
                    <SectionHeading text="Meet The Experts" className="text-3xl sm:text-5xl mb-4" />
                    <p className="text-white/60 max-w-2xl mx-auto text-base sm:text-lg">
                        The engineers, product designers, and strategists behind Optrizo.
                    </p>
                </ScrollReveal>

                <RevealList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
                    {team.map(member => (
                        <RevealItem key={member.id}>
                            <div className="group flex flex-col items-center text-center p-8 bg-black/40 border border-white/10 rounded-3xl hover:border-primary/50 transition-all duration-300 backdrop-blur-md relative overflow-hidden">
                                <div className="relative mb-6">
                                    <div className="absolute -inset-2 rounded-full bg-primary/20 opacity-0 group-hover:opacity-100 blur-lg transition-all duration-500" />
                                    <Avatar className="h-36 w-36 border-2 border-white/10 group-hover:border-primary transition-colors relative z-10 shadow-xl">
                                        <AvatarImage src={member.image || ""} className="object-cover" referrerPolicy="no-referrer" />
                                        <AvatarFallback className="bg-white/5 text-3xl font-bold text-primary">
                                            {member.name?.[0]?.toUpperCase() || "T"}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                                <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{member.name}</h3>
                                <p className="text-primary font-semibold tracking-wider uppercase text-xs mt-2 bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                                    {member.jobTitle || "Engineering Team"}
                                </p>
                            </div>
                        </RevealItem>
                    ))}
                </RevealList>
            </section>

            {/* Section 5: Tech Stack Logos */}
            <section className="py-20 border-t border-white/10 text-center">
                <p className="text-xs font-bold tracking-widest text-primary uppercase mb-10">
                    {settings?.aboutTechStack || "Powered By Enterprise Technologies"}
                </p>

                <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-10 max-w-5xl mx-auto">
                    {techItems.map((tech, i) => (
                        <div key={i} className="flex items-center gap-3 px-6 py-3 bg-black/40 border border-white/10 rounded-2xl text-white/80 font-bold text-sm sm:text-base tracking-tight hover:border-primary/50 hover:text-white transition-all backdrop-blur-md group">
                            {tech.imageUrl ? (
                                <div className="relative w-6 h-6">
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
                            <span>{tech.name}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Section 6: Dynamic Call-to-Action */}
            <section className="py-24 border-t border-white/10">
                <div className="relative bg-gradient-to-b from-primary/10 to-black/80 border border-primary/30 rounded-3xl p-10 sm:p-16 max-w-4xl mx-auto text-center shadow-[0_0_60px_rgba(57,255,20,0.1)] overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />

                    <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4 relative z-10">
                        {settings?.aboutCtaHeadline || "Ready to build your next product?"}
                    </h2>
                    <p className="text-white/70 text-base sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed relative z-10">
                        {settings?.aboutCtaText || "Let's collaborate to build extraordinary web applications, scalable workflows, and digital solutions."}
                    </p>
                    <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link 
                            href="/contact" 
                            className="inline-flex items-center justify-center h-14 px-8 text-base font-bold text-black bg-primary rounded-xl hover:bg-white hover:text-black transition-all shadow-lg hover:shadow-primary/50 group w-full sm:w-auto"
                        >
                            Schedule a Consultation <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link 
                            href="/portal/services" 
                            className="inline-flex items-center justify-center h-14 px-8 text-base font-semibold text-white bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all w-full sm:w-auto"
                        >
                            Explore Our Services
                        </Link>
                    </div>
                </div>
            </section>

        </div>
    );
}
