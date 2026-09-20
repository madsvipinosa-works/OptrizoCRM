import { db } from "@/db";
import { posts, caseStudies, services, testimonials } from "@/db/schema";
import { desc, asc } from "drizzle-orm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostsTab } from "@/features/cms/components/PostsTab";
import { PortfolioTab } from "@/features/cms/components/PortfolioTab";
import { ServicesTab } from "@/features/cms/components/ServicesTab";
import { TestimonialsTab } from "@/features/cms/components/TestimonialsTab";
import { FileText, FolderGit2, Layers, MessageSquareQuote, Sparkles, Star, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function CMSDashboardPage() {
    // Parallel fetch for all content types
    const [allPosts, allProjects, allServices, allTestimonials] = await Promise.all([
        db.query.posts.findMany({ orderBy: [desc(posts.createdAt)] }),
        db.query.caseStudies.findMany({ orderBy: [desc(caseStudies.createdAt)] }),
        db.query.services.findMany({ orderBy: [asc(services.order)] }),
        db.query.testimonials.findMany({ orderBy: [desc(testimonials.id)] }),
    ]);

    // Analytics overview calculations
    const publishedPosts = allPosts.filter(p => p.published).length;
    const publishedProjects = allProjects.filter(p => p.published).length;
    const avgRating = allTestimonials.length
        ? (allTestimonials.reduce((acc, t) => acc + (t.rating || 5), 0) / allTestimonials.length).toFixed(1)
        : "5.0";

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
                    <p className="text-sm text-muted-foreground">Manage blog articles, portfolio showcases, services, and client testimonials.</p>
                </div>
                <div className="flex items-center gap-3 relative">
                    <Button asChild size="sm" className="bg-primary text-black hover:bg-primary/90 font-semibold shadow-md shadow-primary/20">
                        <Link href="/dashboard/posts/new">
                            <Plus className="mr-1.5 h-4 w-4" /> Quick Post
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Content Stats Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card p-5 rounded-xl border border-border flex items-center justify-between relative overflow-hidden group hover:border-primary/40 transition-all">
                    <div className="space-y-1">
                        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Blog Posts</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono text-foreground">{allPosts.length}</span>
                            <span className="text-xs text-primary font-medium">{publishedPosts} Published</span>
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-110 transition-transform">
                        <FileText className="h-6 w-6" />
                    </div>
                </div>

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

                <div className="glass-card p-5 rounded-xl border border-border flex items-center justify-between relative overflow-hidden group hover:border-primary/40 transition-all">
                    <div className="space-y-1">
                        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Client Reviews</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono text-foreground">{allTestimonials.length}</span>
                            <span className="text-xs text-primary font-medium flex items-center gap-1">
                                <Star className="w-3 h-3 fill-primary text-primary" /> {avgRating} Avg
                            </span>
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-110 transition-transform">
                        <MessageSquareQuote className="h-6 w-6" />
                    </div>
                </div>
            </div>

            {/* Main Tabs Container */}
            <Tabs defaultValue="posts" className="w-full">
                <div className="w-full">
                    <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 bg-muted/50 backdrop-blur-xl border border-border p-1.5 rounded-xl gap-1.5 h-auto">
                        <TabsTrigger 
                            value="posts" 
                            className="data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-sm py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium text-muted-foreground flex items-center justify-center gap-1.5 sm:gap-2 transition-all"
                        >
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="whitespace-nowrap">Blog Posts</span>
                            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-foreground/10 text-foreground font-mono hidden sm:inline-block">{allPosts.length}</span>
                        </TabsTrigger>
                        
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
                            value="testimonials" 
                            className="data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-sm py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium text-muted-foreground flex items-center justify-center gap-1.5 sm:gap-2 transition-all"
                        >
                            <MessageSquareQuote className="w-4 h-4 shrink-0" />
                            <span className="whitespace-nowrap">Testimonials</span>
                            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-foreground/10 text-foreground font-mono hidden sm:inline-block">{allTestimonials.length}</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="mt-6">
                    <TabsContent value="posts" className="mt-0 outline-none">
                        <PostsTab posts={allPosts} />
                    </TabsContent>
                    
                    <TabsContent value="portfolio" className="mt-0 outline-none">
                        <PortfolioTab projects={allProjects} />
                    </TabsContent>
                    
                    <TabsContent value="services" className="mt-0 outline-none">
                        <ServicesTab services={allServices} />
                    </TabsContent>
                    
                    <TabsContent value="testimonials" className="mt-0 outline-none">
                        <TestimonialsTab testimonials={allTestimonials} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}

