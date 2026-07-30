import { db } from "@/db";
import { posts, projects, services, testimonials } from "@/db/schema";
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
        db.query.projects.findMany({ orderBy: [desc(projects.createdAt)] }),
        db.query.services.findMany({ orderBy: [asc(services.order)] }),
        db.query.testimonials.findMany({ orderBy: [desc(testimonials.id)] }),
    ]);

    // Analytics overview calculations
    const publishedPosts = allPosts.filter(p => p.published).length;
    const publishedProjects = allProjects.filter(p => p.status === "published").length;
    const avgRating = allTestimonials.length
        ? (allTestimonials.reduce((acc, t) => acc + (t.rating || 5), 0) / allTestimonials.length).toFixed(1)
        : "5.0";

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-zinc-900/80 via-zinc-900/40 to-transparent p-6 rounded-2xl border border-white/10 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="space-y-1 relative">
                    <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-1">
                        <Sparkles className="w-3.5 h-3.5" /> Content Management Studio
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">Content Manager</h1>
                    <p className="text-sm text-zinc-400">Manage blog articles, portfolio showcases, services, and client testimonials.</p>
                </div>
                <div className="flex items-center gap-3 relative">
                    <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/20">
                        <Link href="/dashboard/posts/new">
                            <Plus className="mr-1.5 h-4 w-4" /> Quick Post
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Content Stats Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card p-5 rounded-xl border border-white/10 flex items-center justify-between relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                    <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Blog Posts</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-white">{allPosts.length}</span>
                            <span className="text-xs text-emerald-400 font-medium">{publishedPosts} Published</span>
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform">
                        <FileText className="h-6 w-6" />
                    </div>
                </div>

                <div className="glass-card p-5 rounded-xl border border-white/10 flex items-center justify-between relative overflow-hidden group hover:border-purple-500/30 transition-all">
                    <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Case Studies</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-white">{allProjects.length}</span>
                            <span className="text-xs text-purple-400 font-medium">{publishedProjects} Live</span>
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-110 transition-transform">
                        <FolderGit2 className="h-6 w-6" />
                    </div>
                </div>

                <div className="glass-card p-5 rounded-xl border border-white/10 flex items-center justify-between relative overflow-hidden group hover:border-amber-500/30 transition-all">
                    <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Active Services</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-white">{allServices.length}</span>
                            <span className="text-xs text-amber-400 font-medium">Offerings</span>
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
                        <Layers className="h-6 w-6" />
                    </div>
                </div>

                <div className="glass-card p-5 rounded-xl border border-white/10 flex items-center justify-between relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                    <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Client Reviews</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-white">{allTestimonials.length}</span>
                            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                                <Star className="w-3 h-3 fill-emerald-400" /> {avgRating} Avg
                            </span>
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                        <MessageSquareQuote className="h-6 w-6" />
                    </div>
                </div>
            </div>

            {/* Main Tabs Container */}
            <Tabs defaultValue="posts" className="w-full">
                <div className="overflow-x-auto pb-1 scrollbar-none">
                    <TabsList className="flex sm:grid w-full sm:grid-cols-2 md:grid-cols-4 bg-zinc-900/90 border border-white/10 p-1.5 rounded-xl gap-1.5 min-w-max sm:min-w-0">
                        <TabsTrigger 
                            value="posts" 
                            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-600/25 border border-transparent py-2.5 px-3.5 rounded-lg text-xs font-semibold text-zinc-400 flex items-center justify-center gap-2 transition-all flex-1"
                        >
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="whitespace-nowrap">Blog Posts</span>
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/10 text-white font-mono">{allPosts.length}</span>
                        </TabsTrigger>
                        
                        <TabsTrigger 
                            value="portfolio" 
                            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-600/25 border border-transparent py-2.5 px-3.5 rounded-lg text-xs font-semibold text-zinc-400 flex items-center justify-center gap-2 transition-all flex-1"
                        >
                            <FolderGit2 className="w-4 h-4 shrink-0" />
                            <span className="whitespace-nowrap">Portfolio</span>
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/10 text-white font-mono">{allProjects.length}</span>
                        </TabsTrigger>
                        
                        <TabsTrigger 
                            value="services" 
                            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-600/25 border border-transparent py-2.5 px-3.5 rounded-lg text-xs font-semibold text-zinc-400 flex items-center justify-center gap-2 transition-all flex-1"
                        >
                            <Layers className="w-4 h-4 shrink-0" />
                            <span className="whitespace-nowrap">Services</span>
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/10 text-white font-mono">{allServices.length}</span>
                        </TabsTrigger>
                        
                        <TabsTrigger 
                            value="testimonials" 
                            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-600/25 border border-transparent py-2.5 px-3.5 rounded-lg text-xs font-semibold text-zinc-400 flex items-center justify-center gap-2 transition-all flex-1"
                        >
                            <MessageSquareQuote className="w-4 h-4 shrink-0" />
                            <span className="whitespace-nowrap">Testimonials</span>
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/10 text-white font-mono">{allTestimonials.length}</span>
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

