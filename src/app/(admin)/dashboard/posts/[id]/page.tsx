import { PostForm } from "@/features/cms/components/PostForm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/auth";

interface Props {
    params: Promise<{ id: string }>;
}

export default async function EditPostPage({ params }: Props) {
    const { id } = await params;
    const session = await auth();
    const isAdmin = session?.user?.role === "admin";

    const post = await db.query.posts.findFirst({
        where: eq(posts.id, id),
    });

    if (!post) {
        notFound();
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Edit Post</h1>
                <p className="text-muted-foreground">Make changes to your article.</p>
            </div>
            <PostForm initialData={post} isAdmin={isAdmin} />
        </div>
    );
}
