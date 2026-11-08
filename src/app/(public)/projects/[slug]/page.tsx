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
        <article className="mx-auto w-full max-w-4xl px-4 pb-24 pt-32 sm:px-6">
            <Button asChild variant="ghost" className="mb-8 -ml-3 text-muted-foreground hover:text-foreground">
                <Link href="/projects">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to work
                </Link>
            </Button>

            <header className="mb-12">
                <div className="text-brand-deep font-semibold mb-4 text-sm">
                    {project.clientDisplayName}
                </div>
                <h1 className="mb-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                    {project.title}
                </h1>
                {project.summary && (
                    <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                        {project.summary}
                    </p>
                )}
            </header>

            <div className="mb-12 h-px w-full bg-border" />

            {/* Render HTML / Content */}
            {project.content ? (
                <div
                    className="max-w-xl text-base leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-brand-deep [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:mb-3 [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground first:[&_h2]:mt-0 [&_h3]:mb-2 [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:mt-2 [&_li]:pl-1 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-4 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-brand-deep"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.content) }}
                />
            ) : null}
        </article>
    );
}
