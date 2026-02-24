import { db } from "@/db";
import { posts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { format } from "date-fns";

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
    const { slug } = await params;
    console.log(`[Blog] Requesting slug: ${slug}`);

    // Decode slug just in case URL encoding is messing it up
    const decodedSlug = decodeURIComponent(slug);
    console.log(`[Blog] Decoded slug: ${decodedSlug}`);

    const post = await db.query.posts.findFirst({
        where: eq(posts.slug, decodedSlug),
    });
    console.log(`[Blog] Found post: ${post?.id}`);

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
                dangerouslySetInnerHTML={{ __html: post.content || "" }}
            />
        </article>
    );
}
