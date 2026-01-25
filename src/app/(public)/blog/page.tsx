import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { format } from "date-fns";

export default async function BlogIndexPage() {
    const publishedPosts = await db.query.posts.findMany({
        where: eq(posts.published, true),
        orderBy: [desc(posts.createdAt)],
    });

    return (
        <div className="container mx-auto px-4 py-24">
            <div className="text-center max-w-2xl mx-auto mb-16">
                <Badge variant="outline" className="mb-4 text-primary border-primary/20">Our Thoughts</Badge>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Latest Insights & News</h1>
                <p className="text-lg text-muted-foreground">
                    Stay updated with the latest trends in software development, design, and digital strategy.
                </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {publishedPosts.map((post) => (
                    <Card key={post.id} className="bg-black/50 border-white/10 overflow-hidden hover:border-primary/50 transition-colors group">
                        <div className="relative h-48 w-full bg-white/5 group-hover:bg-white/10 transition-colors overflow-hidden">
                            {post.coverImage && (
                                <Image
                                    src={post.coverImage}
                                    alt={post.title}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                            )}
                        </div>

                        <CardHeader>
                            <div className="text-xs text-primary mb-2">
                                {format(post.createdAt, 'MMM d, yyyy')}
                            </div>
                            <CardTitle className="text-xl group-hover:text-primary transition-colors">
                                <Link href={`/blog/${post.slug}`}>
                                    {post.title}
                                </Link>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground line-clamp-3 text-sm">
                                {post.slug /* Using slug as excerpt for now since we don't have separate excerpt field populated yet */}
                            </p>
                        </CardContent>
                        <CardFooter>
                            <Button asChild variant="link" className="px-0 text-white group-hover:text-primary">
                                <Link href={`/blog/${post.slug}`}>Read Article &rarr;</Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
