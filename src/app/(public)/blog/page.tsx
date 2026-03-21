import { db } from "@/db";
import { posts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NewsCards, type NewsCard } from "@/components/ui/news-cards";
import { formatDistanceToNow } from "date-fns";

export default async function BlogIndexPage() {
    const publishedPosts = await db.query.posts.findMany({
        where: eq(posts.published, true),
        orderBy: [desc(posts.createdAt)],
    });

    const mappedPosts: NewsCard[] = publishedPosts.map((post) => ({
        id: post.id.toString(),
        title: post.title,
        category: "Blog",
        subcategory: "Article",
        timeAgo: formatDistanceToNow(post.createdAt, { addSuffix: true }),
        location: "Optrizo HQ",
        image: post.coverImage || "https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=2670&auto=format&fit=crop",
        gradientColors: ["from-primary/20", "to-purple-500/20"],
        content: [
            post.slug,
            post.content || "Full article content coming soon."
        ]
    }));

    return (
        <div className="container mx-auto px-0 min-h-screen">
            <NewsCards
                title="Latest Insights & News"
                subtitle="Stay updated with the latest trends in software development, design, and digital strategy."
                newsCards={mappedPosts}
            />
        </div>
    );
}
