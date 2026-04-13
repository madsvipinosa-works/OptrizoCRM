import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";

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
    let project = null;
    let systemError: Error | null = null;

    try {
        const { slug } = await params;
        const decodedSlug = decodeURIComponent(slug);

        project = await db.query.projects.findFirst({
            where: eq(projects.slug, decodedSlug),
        });
    } catch (e) {
        systemError = e as Error;
    }

    if (systemError) {
        return (
            <div className="container mx-auto px-4 py-24 max-w-3xl">
                <div className="bg-red-950/50 border border-red-500 p-8 rounded-lg text-red-200">
                    <h1 className="text-2xl font-bold mb-4 text-red-500">System Crash (Remote Debug)</h1>
                    <p className="font-mono text-sm mb-4">{systemError.message}</p>
                    <pre className="text-xs bg-black/50 p-4 rounded overflow-auto">{systemError.stack}</pre>
                </div>
            </div>
        );
    }

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
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.content) }}
            />
        </article>
    );
}
