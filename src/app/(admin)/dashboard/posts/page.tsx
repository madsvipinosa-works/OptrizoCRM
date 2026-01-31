import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Plus, Edit } from "lucide-react";
import { db } from "@/db"; // db is now correctly typed
import { posts } from "@/db/schema";
import { desc } from "drizzle-orm";
import { DeletePostButton } from "@/features/cms/components/DeletePostButton";

export default async function PostsPage() {
    const allPosts = await db.query.posts.findMany({
        orderBy: [desc(posts.createdAt)],
    });

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Blog Posts</h1>
                    <p className="text-muted-foreground">Manage your articles and announcements.</p>
                </div>
                <Button asChild className="bg-primary text-black font-bold">
                    <Link href="/dashboard/posts/new">
                        <Plus className="mr-2 h-4 w-4" /> New Post
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allPosts.map((post) => (
                    <Card key={post.id} className="bg-black/40 border-primary/20 flex flex-col justify-between">
                        <CardHeader>
                            <CardTitle className="line-clamp-2">{post.title}</CardTitle>
                            <CardDescription className="line-clamp-1">{post.slug}</CardDescription>
                        </CardHeader>
                        <CardFooter className="flex justify-between border-t border-white/10 pt-4">
                            <div className="text-xs text-muted-foreground">
                                {post.published ? (
                                    <span className="text-green-500 font-medium">Published</span>
                                ) : (
                                    <span className="text-yellow-500 font-medium">Draft</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button asChild size="icon" variant="ghost" className="h-8 w-8 hover:text-primary">
                                    <Link href={`/dashboard/posts/${post.id}`}>
                                        <Edit className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <DeletePostButton id={post.id} />
                            </div>
                        </CardFooter>
                    </Card>
                ))}

                {allPosts.length === 0 && (
                    <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-lg">
                        <p className="text-muted-foreground">No posts yet. Write something amazing!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
