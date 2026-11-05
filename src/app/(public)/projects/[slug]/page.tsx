import { getPublishedPortfolioBySlug } from "@/features/cms/content/public-queries";
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
    const decodedSlug = decodeURIComponent(slug);
    const project = await getPublishedPortfolioBySlug(decodedSlug);

    if (!project) {
        return { title: "Case Study Not Found" };
    }

    return {
        title: `${project.title} | Case Study`,
        description: project.summary || `Case study for ${project.clientDisplayName}`,
    };
}

export default async function ProjectDetailPage({ params }: Props) {
    const { slug } = await params;
    const decodedSlug = decodeURIComponent(slug);
    const project = await getPublishedPortfolioBySlug(decodedSlug);

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
                    {project.clientDisplayName}
                </div>
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-glow">
                    {project.title}
                </h1>
                {project.summary && (
                    <p className="text-xl text-muted-foreground max-w-2xl">
                        {project.summary}
                    </p>
                )}
            </header>

            <div className="h-px w-full bg-white/10 mb-12" />

            {/* Render HTML / Content */}
            {project.content ? (
                <div
                    className="prose prose-invert prose-lg max-w-none prose-headings:text-white prose-a:text-primary hover:prose-a:text-primary/80"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.content) }}
                />
            ) : null}
        </article>
    );
}
