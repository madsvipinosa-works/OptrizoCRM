import { db } from "@/db";
import { services } from "@/db/schema";
import { asc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import Link from "next/link";
import { ArrowRight, Lock, Users, Zap } from "lucide-react";
import { ServiceCardItem } from "@/components/public/ServiceCardItem";

const SERVICE_ASSETS: Record<string, { tags: string[] }> = {
    "Web Development": {
        tags: ["Next.js", "React", "TypeScript", "Micro-frontends"],
    },
    "UI/UX Design": {
        tags: ["Design Systems", "Prototyping", "WCAG AAA"],
    },
    "Mobile App Development": {
        tags: ["React Native", "iOS", "Android", "Swift"],
    },
    "AI Integration": {
        tags: ["LLM", "RAG", "PyTorch", "Vector Search"],
    },
    "Cloud & DevOps": {
        tags: ["Terraform", "Kubernetes", "AWS", "CI/CD"],
    },
};

export default async function ServicesPage() {
    const session = await auth();
    const isLoggedIn = !!session?.user;

    const allServices = await db.query.services.findMany({
        orderBy: [asc(services.order)],
    });

    return (
        <div className="relative min-h-screen bg-background text-foreground overflow-hidden font-sans">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -translate-y-1/2 pointer-events-none" />
            <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="container relative z-10 mx-auto px-4 pt-32 pb-24">
                {/* Hero Section */}
                <div className="max-w-4xl mx-auto mb-20 text-center flex flex-col items-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/80 border border-border backdrop-blur-md mb-8 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Capabilities & Practice Areas</span>
                    </div>
                    
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 text-foreground">
                        End-to-End <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
                            Digital Solutions
                        </span>
                    </h1>
                    
                    <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed mb-12 max-w-3xl">
                        From architectural ideation to high-scale deployment, we partner with visionary engineering leaders and enterprise teams to engineer category-defining digital products.
                    </p>
                </div>

                {/* Services Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-32 items-stretch">
                    {allServices.map((service) => {
                        const mappedAsset = SERVICE_ASSETS[service.title] || {
                            tags: ["Architecture", "Engineering"],
                        };

                        return (
                            <ServiceCardItem
                                key={service.id}
                                service={service}
                                images={[]}
                                tags={mappedAsset.tags}
                                isLoggedIn={isLoggedIn}
                            />
                        );
                    })}

                    {allServices.length === 0 && (
                        <div className="col-span-full py-24 text-center border border-dashed border-border rounded-2xl bg-muted/30">
                            <p className="text-muted-foreground text-lg">Services are being updated. Check back soon!</p>
                        </div>
                    )}
                </div>

                {/* Bottom CTA Section */}
                <div className="relative rounded-3xl border border-border bg-card/60 backdrop-blur-xl overflow-hidden p-8 md:p-16 shadow-xl">
                    <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
                    
                    <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <span className="text-primary font-bold tracking-widest text-sm uppercase mb-4 block">Bespoke Custom Solutions</span>
                            <h2 className="text-3xl md:text-5xl font-bold text-card-foreground mb-6 tracking-tight">Have a complex engineering challenge?</h2>
                            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                                Whether you require a dedicated embedded engineering squad, technical advisory audit, or rapid prototype turnaround, we architect custom engagements tailored to your roadmap.
                            </p>
                            
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full px-8 shadow-md">
                                    <Link href="/contact">
                                        Schedule Technical Discovery <ArrowRight className="ml-2 h-5 w-5" />
                                    </Link>
                                </Button>
                                <Button asChild size="lg" variant="outline" className="border-border hover:bg-muted text-foreground font-bold rounded-full px-8 bg-transparent">
                                    <Link href="/contact">
                                        Download Capabilities (PDF)
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        {/* Social Proof / Guarantee Bar */}
                        <div className="flex flex-col gap-6 lg:border-l border-border lg:pl-12">
                            <div className="flex items-start gap-4">
                                <div className="mt-1 p-2 rounded-lg bg-muted border border-border text-primary">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-card-foreground text-lg">NDA Protected by Default</h4>
                                    <p className="text-muted-foreground text-sm mt-1">Enterprise-grade security and confidentiality from day one.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="mt-1 p-2 rounded-lg bg-muted border border-border text-primary">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-card-foreground text-lg">Direct Access to Staff Engineers</h4>
                                    <p className="text-muted-foreground text-sm mt-1">No middle-men. Collaborate directly with senior architects.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="mt-1 p-2 rounded-lg bg-muted border border-border text-primary">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-card-foreground text-lg">2-Week Rapid Delivery Sprints</h4>
                                    <p className="text-muted-foreground text-sm mt-1">Iterative, high-velocity shipping cycles with transparent progress.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
