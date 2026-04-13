import { db } from "@/db";
import { posts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { format } from "date-fns";
import { sanitizeHtml } from "@/lib/sanitize";

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const post = await db.query.posts.findFirst({
        where: eq(posts.slug, slug),
    });

    if (!post) {
        return { title: "Post Not Found" };
    }

    return {
        title: post.title,
        description: `Read ${post.title} on Optrizo.`,
    };
}

export default async function BlogPostPage({ params }: Props) {
    let post = null;
    let systemError: Error | null = null;

    try {
        const { slug } = await params;
        const decodedSlug = decodeURIComponent(slug);

        post = await db.query.posts.findFirst({
            where: eq(posts.slug, decodedSlug),
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

    if (!post) {
        notFound();
    }

    return (
        <article className="container mx-auto px-4 py-24 max-w-3xl">
            <header className="mb-12 text-center">
                <time className="text-sm text-primary font-medium mb-4 block">
                    {format(post.createdAt, 'MMMM d, yyyy')}
                </time>
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 text-glow">
                    {post.title}
                </h1>
                <div className="h-px w-24 bg-primary mx-auto" />
            </header>

            {/* Render Tiptap HTML Content */}
            <div
                className="prose prose-invert prose-lg mx-auto prose-headings:text-white prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
            />
        </article>
    );
}
