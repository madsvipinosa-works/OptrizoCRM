import { db } from "@/db";
import { caseStudies, services, aboutValues } from "@/db/schema";
import { desc, asc } from "drizzle-orm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortfolioTab } from "@/features/cms/components/PortfolioTab";
import { ServicesTab } from "@/features/cms/components/ServicesTab";
import { HeroTab } from "@/features/cms/components/HeroTab";
import { AboutTab } from "@/features/cms/components/AboutTab";
import { getSiteSettings } from "@/features/cms/actions";
import { FolderGit2, Layers, Sparkles, Tv, Info } from "lucide-react";

export default async function CMSDashboardPage() {
    // Parallel fetch for portfolio, services, site settings, and about page values
    const [allProjects, allServices, settings, values] = await Promise.all([
        db.query.caseStudies.findMany({ orderBy: [desc(caseStudies.createdAt)] }),
        db.query.services.findMany({ orderBy: [asc(services.order)] }),
        getSiteSettings(),
        db.query.aboutValues.findMany({
            orderBy: (aboutValues, { asc }) => [asc(aboutValues.order)],
        }),
    ]);

    // Analytics overview calculations
    const publishedProjects = allProjects.filter(p => p.published).length;

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-2xl border border-border relative overflow-hidden">
                <div className="absolute -top-12 -left-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="space-y-1 relative">
                    <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-1">
                        <Sparkles className="w-3.5 h-3.5" /> Content Management Studio
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground text-glow">Content Manager</h1>
                    <p className="text-sm text-muted-foreground">Manage portfolio showcases, services, and site settings.</p>
                </div>
            </div>

            {/* Content Stats Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-card p-5 rounded-xl border border-border flex items-center justify-between relative overflow-hidden group hover:border-primary/40 transition-all">
                    <div className="space-y-1">
                        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Case Studies</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono text-foreground">{allProjects.length}</span>
                            <span className="text-xs text-purple-500 dark:text-purple-400 font-medium">{publishedProjects} Live</span>
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20 group-hover:scale-110 transition-transform">
                        <FolderGit2 className="h-6 w-6" />
                    </div>
                </div>

                <div className="glass-card p-5 rounded-xl border border-border flex items-center justify-between relative overflow-hidden group hover:border-primary/40 transition-all">
                    <div className="space-y-1">
                        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Active Services</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono text-foreground">{allServices.length}</span>
                            <span className="text-xs text-amber-500 dark:text-amber-400 font-medium">Offerings</span>
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
                        <Layers className="h-6 w-6" />
                    </div>
                </div>
            </div>

            {/* Main Tabs Container */}
            <Tabs defaultValue="portfolio" className="w-full">
                <div className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-muted/50 backdrop-blur-xl border border-border p-1.5 rounded-xl gap-1.5 h-auto">
                        <TabsTrigger 
                            value="portfolio" 
                            className="data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-sm py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium text-muted-foreground flex items-center justify-center gap-1.5 sm:gap-2 transition-all"
                        >
                            <FolderGit2 className="w-4 h-4 shrink-0" />
                            <span className="whitespace-nowrap">Portfolio</span>
                            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-foreground/10 text-foreground font-mono hidden sm:inline-block">{allProjects.length}</span>
                        </TabsTrigger>
                        
                        <TabsTrigger 
                            value="services" 
                            className="data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-sm py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium text-muted-foreground flex items-center justify-center gap-1.5 sm:gap-2 transition-all"
                        >
                            <Layers className="w-4 h-4 shrink-0" />
                            <span className="whitespace-nowrap">Services</span>
                            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-foreground/10 text-foreground font-mono hidden sm:inline-block">{allServices.length}</span>
                        </TabsTrigger>

                        <TabsTrigger 
                            value="hero" 
                            className="data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-sm py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium text-muted-foreground flex items-center justify-center gap-1.5 sm:gap-2 transition-all"
                        >
                            <Tv className="w-4 h-4 shrink-0" />
                            <span className="whitespace-nowrap">Hero & Media</span>
                        </TabsTrigger>

                        <TabsTrigger 
                            value="about" 
                            className="data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-sm py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium text-muted-foreground flex items-center justify-center gap-1.5 sm:gap-2 transition-all"
                        >
                            <Info className="w-4 h-4 shrink-0" />
                            <span className="whitespace-nowrap">About Section</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="mt-6">
                    <TabsContent value="portfolio" className="mt-0 outline-none">
                        <PortfolioTab projects={allProjects} />
                    </TabsContent>
                    
                    <TabsContent value="services" className="mt-0 outline-none">
                        <ServicesTab services={allServices} />
                    </TabsContent>

                    <TabsContent value="hero" className="mt-0 outline-none">
                        <HeroTab settings={settings} />
                    </TabsContent>

                    <TabsContent value="about" className="mt-0 outline-none">
                        <AboutTab settings={settings || {}} values={values} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}

