"use client";

import { createPost } from "@/features/cms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Editor } from "@/features/cms/components/Editor";
import { useActionState, useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

export function PostForm() {
    const [state, formAction, isPending] = useActionState(createPost, { message: "", success: false });
    const [content, setContent] = useState("<p>Start writing...</p>");
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
            <Card className="bg-black/40 border-primary/20">
                <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Title</Label>
                            <Input name="title" placeholder="Enter post title" className="bg-white/5 border-white/10" required />
                        </div>
                        <div className="space-y-2">
                            <Label>Slug</Label>
                            <Input name="slug" placeholder="my-awesome-post" className="bg-white/5 border-white/10" required />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Content</Label>
                        <Editor content={content} onChange={setContent} />
                        {/* Hidden input to send content in FormData */}
                        <input type="hidden" name="content" value={content} />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
                <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" disabled={isPending} className="bg-primary text-black font-bold">
                    {isPending ? "Publishing..." : "Publish Post"}
                </Button>
            </div>
        </form>
    );
}
