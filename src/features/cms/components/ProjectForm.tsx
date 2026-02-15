"use client";

import { createProject, updateProject } from "@/features/cms/actions"; // Make sure to export updateProject from actions
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Editor } from "@/features/cms/components/Editor";
import { useActionState, useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

import { ImageUpload } from "@/components/ui/image-upload";

// ... existing imports

interface ProjectFormProps {
    initialData?: {
        id: string;
        title: string;
        clientName: string | null;
        slug: string;
        description: string | null;
        content: string | null;
        coverImage: string | null; // Add this
    };
}

export function ProjectForm({ initialData }: ProjectFormProps) {
    const action = initialData ? updateProject : createProject;

    const [state, formAction, isPending] = useActionState(action, { message: "", success: false });
    const [content, setContent] = useState(initialData?.content || "<p>Describe the project result...</p>");
    const [coverImage, setCoverImage] = useState(initialData?.coverImage || ""); // State for image
    const router = useRouter();

    useEffect(() => {
        if (state.message) {
            if (state.success) {
                toast.success(state.message);
                router.push("/dashboard/portfolio");
            } else {
                toast.error(state.message);
            }
        }
    }, [state, router]);

    return (
        <form action={formAction} className="space-y-8">
            {initialData && <input type="hidden" name="id" value={initialData.id} />}
            <input type="hidden" name="coverImage" value={coverImage} /> {/* Send to server */}

            <Card className="bg-black/40 border-primary/20">
                <CardContent className="pt-6 space-y-6">
                    <div className="space-y-4">
                        <Label>Project Cover Image</Label>
                        <ImageUpload value={coverImage} onChange={setCoverImage} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Project Title</Label>
                            <Input
                                name="title"
                                defaultValue={initialData?.title}
                                placeholder="e.g. Redesign for TechCorp"
                                className="bg-white/5 border-white/10"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Client Name</Label>
                            <Input
                                name="clientName"
                                defaultValue={initialData?.clientName || ""}
                                placeholder="e.g. TechCorp Inc."
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Slug (Optional)</Label>
                        <Input
                            name="slug"
                            defaultValue={initialData?.slug}
                            placeholder="redesign-techcorp"
                            className="bg-white/5 border-white/10"
                        />
                        <p className="text-xs text-muted-foreground">Leave blank to auto-generate from title.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Short Description (Excerpt)</Label>
                        <Textarea
                            name="description"
                            defaultValue={initialData?.description || ""}
                            placeholder="A brief summary shown on the card..."
                            className="bg-white/5 border-white/10"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Full Case Study</Label>
                        <Editor content={content} onChange={setContent} />
                        <input type="hidden" name="content" value={content} />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
                <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" disabled={isPending} className="bg-primary text-black font-bold">
                    {isPending ? "Saving..." : (initialData ? "Update Project" : "Create Project")}
                </Button>
            </div>
        </form>
    );
}
