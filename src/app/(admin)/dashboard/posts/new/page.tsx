import { PostForm } from "@/features/cms/components/PostForm";
import { auth } from "@/auth";

export default async function NewPostPage() {
    const session = await auth();
    const isAdmin = session?.user?.role === "admin";

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Create New Post</h1>
                <p className="text-muted-foreground">Share your thoughts with the world.</p>
            </div>
            <PostForm isAdmin={isAdmin} />
        </div>
    );
}
