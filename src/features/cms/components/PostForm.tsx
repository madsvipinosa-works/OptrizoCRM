"use client";

import { createPost, updatePost } from "@/features/cms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Editor } from "@/features/cms/components/Editor";
import { useActionState, useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

import { ImageUpload } from "@/components/ui/image-upload";

interface PostFormProps {
    initialData?: {
        id: string;
        title: string;
        slug: string;
        content: string | null;
        coverImage: string | null;
        published?: boolean;
    };
    isAdmin: boolean;
}

export function PostForm({ initialData, isAdmin }: PostFormProps) {
    const action = initialData ? updatePost : createPost;
    const [state, formAction, isPending] = useActionState(action, { message: "", success: false });
    const [content, setContent] = useState(initialData?.content || "<p>Start writing...</p>");
    const [coverImage, setCoverImage] = useState(initialData?.coverImage || ""); // State for image
    const router = useRouter();

    useEffect(() => {
        if (state.message) {
            if (state.success) {
                toast.success(state.message);
                router.push("/dashboard/posts");
            } else {
                toast.error(state.message);
            }
        }
    }, [state, router]);

    return (
        <form action={formAction} className="space-y-8">
            {initialData && <input type="hidden" name="id" value={initialData.id} />}
            <input type="hidden" name="coverImage" value={coverImage} />

            <Card className="bg-black/40 border-primary/20">
                <CardContent className="pt-6 space-y-6">
                    <div className="space-y-4">
                        <Label>Cover Image</Label>
                        <ImageUpload value={coverImage} onChange={setCoverImage} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                                name="title"
                                defaultValue={initialData?.title}
                                placeholder="Enter post title"
                                className="bg-white/5 border-white/10"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Slug</Label>
                            <Input
                                name="slug"
                                defaultValue={initialData?.slug}
                                placeholder="my-awesome-post"
                                className="bg-white/5 border-white/10"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Content</Label>
                        <Editor content={content} onChange={setContent} />
                        {/* Hidden input to send content in FormData */}
                        <input type="hidden" name="content" value={content} />
                    </div>

                    {isAdmin && (
                        <div className="space-y-2">
                            <Label>Publish Status</Label>
                            <select
                                name="published"
                                defaultValue={initialData?.published ? "true" : "false"}
                                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                <option value="true" className="bg-black">Published</option>
                                <option value="false" className="bg-black">Draft</option>
                            </select>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
                <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" disabled={isPending} className="bg-primary text-black font-bold">
                    {isPending ? "Saving..." : (initialData ? "Update Post" : "Publish Post")}
                </Button>
            </div>
        </form>
    );
}
