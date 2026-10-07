import { db } from "@/db";
import { caseStudies } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = {
    title: "Case Studies & Portfolio | Optrizo Digital Solutions",
    description: "Explore our featured software engineering case studies, digital platforms, and cloud architecture deployments.",
};

export default async function ProjectsIndexPage() {
    const publishedProjects = await db.query.caseStudies.findMany({
        where: eq(caseStudies.published, true),
        orderBy: [desc(caseStudies.createdAt)],
    });

    return (
        <div className="min-h-screen bg-background text-foreground pt-32 pb-24 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] opacity-70" />
                <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[150px] opacity-50" />
                <div className="absolute inset-0 bg-background/50 backdrop-blur-3xl" />
            </div>

            <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Hero Section */}
                <div className="text-center max-w-3xl mx-auto mb-20 space-y-6">
                    <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold tracking-wider uppercase border border-primary/20 inline-block mb-2">
                        Selected Works
                    </span>
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
                        Engineering Case Studies
                    </h1>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        Explore how we partner with market leaders to build high-performance web applications, striking brand platforms, and mission-critical cloud infrastructure.
                    </p>
                </div>

                {/* Projects Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 md:gap-12">
                    {publishedProjects.map((project) => {
                        const tags = Array.isArray(project.technologies) ? project.technologies as string[] : [];
                        
                        return (
                            <Link href={`/projects/${project.slug}`} key={project.id} className="group flex flex-col space-y-5 cursor-pointer">
                                {/* Image Container */}
                                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-card border border-border shadow-sm group-hover:border-primary/50 transition-all duration-500">
                                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent z-10" />
                                    {project.coverImage ? (
                                        <Image
                                            src={project.coverImage}
                                            alt={project.title}
                                            fill
                                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-muted/30">
                                            <span className="text-muted-foreground font-mono">[ Graphic Visualization ]</span>
                                        </div>
                                    )}
                                    
                                    {/* Client Name Badge */}
                                    <div className="absolute top-4 left-4 z-20">
                                        <span className="px-3 py-1 bg-background/80 backdrop-blur-md border border-border text-foreground text-xs font-semibold uppercase tracking-wider rounded-full shadow-sm">
                                            {project.clientName || "Enterprise Partner"}
                                        </span>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="space-y-3 flex-1 flex flex-col">
                                    <div className="flex flex-wrap gap-2">
                                        {tags.slice(0, 3).map((tag, i) => (
                                            <span 
                                                key={i}
                                                className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                    
                                    <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                                        {project.title}
                                    </h3>
                                    
                                    <p className="text-muted-foreground line-clamp-2">
                                        {project.description || "Detailed case study of enterprise platform architecture and software engineering."}
                                    </p>

                                    <div className="mt-auto pt-4 flex items-center text-primary font-semibold text-sm">
                                        Read Case Study
                                        <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
