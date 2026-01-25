import { db } from "@/db";
import { posts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export async function BlogTeaserGrid() {
    const latestPosts = await db.query.posts.findMany({
        where: eq(posts.published, true),
        orderBy: [desc(posts.createdAt)],
        limit: 3,
    });

    if (latestPosts.length === 0) {
        return <div className="text-center text-muted-foreground">No posts yet. Check back soon!</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {latestPosts.map((post) => (
                <Link href={`/blog/${post.slug}`} key={post.id} className="group block">
                    <div className="relative h-48 bg-white/5 rounded-xl mb-4 overflow-hidden border border-white/10 group-hover:border-primary/50 transition-colors">
                        {post.coverImage ? (
                            <Image
                                src={post.coverImage}
                                alt={post.title}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        )}
                        <Badge className="absolute top-4 left-4 bg-primary text-black hover:bg-primary">
                            Latest
                        </Badge>
                    </div>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
                    <p className="text-sm text-muted-foreground">{format(post.createdAt, 'MMM d, yyyy')}</p>
                </Link>
            ))}
        </div>
    );
}
