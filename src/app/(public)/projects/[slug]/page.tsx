import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const project = await db.query.projects.findFirst({
        where: eq(projects.slug, slug),
    });

    if (!project) {
        return { title: "Project Not Found" };
    }

    return {
        title: `${project.title} | Case Study`,
        description: project.description || `Case study for ${project.clientName}`,
    };
}

export default async function ProjectDetailPage({ params }: Props) {
    const { slug } = await params;

    // Decode slug to handle potential encoding issues
    const decodedSlug = decodeURIComponent(slug);

    const project = await db.query.projects.findFirst({
        where: eq(projects.slug, decodedSlug),
    });

    if (!project) {
        notFound();
    }

    return (
        <article className="container mx-auto px-4 py-24 max-w-4xl">
            <Button asChild variant="ghost" className="mb-8 -ml-4 text-muted-foreground hover:text-white">
                <Link href="/projects">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
                </Link>
            </Button>

            <header className="mb-12">
                <div className="text-primary font-bold tracking-widest uppercase mb-4 text-sm">
                    {project.clientName}
                </div>
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-glow">
                    {project.title}
                </h1>
                {project.description && (
                    <p className="text-xl text-muted-foreground max-w-2xl">
                        {project.description}
                    </p>
                )}
            </header>

            <div className="h-px w-full bg-white/10 mb-12" />

            {/* Render Tiptap HTML Content */}
            <div
                className="prose prose-invert prose-lg max-w-none prose-headings:text-white prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: project.content || "" }}
            />
        </article>
    );
}
