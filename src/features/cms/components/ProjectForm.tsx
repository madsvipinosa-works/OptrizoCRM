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
        coverImage: string | null;
        published: boolean;
    };
}

export function ProjectForm({ initialData }: ProjectFormProps) {
    const action = initialData ? updateProject : createProject;

    const [state, formAction, isPending] = useActionState(action, { message: "", success: false });
    const [content, setContent] = useState(initialData?.content || "<p>Describe the project result...</p>");
    const [coverImage, setCoverImage] = useState(initialData?.coverImage || ""); // State for image
    const [published, setPublished] = useState(initialData?.published ?? false);
    const router = useRouter();

    useEffect(() => {
        if (state.message) {
            if (state.success) {
                toast.success(state.message);
                router.push("/dashboard/cms");
            } else {
                toast.error(state.message);
            }
        }
    }, [state, router]);

    return (
        <form action={formAction} className="space-y-8">
            {initialData && <input type="hidden" name="id" value={initialData.id} />}
            <input type="hidden" name="coverImage" value={coverImage} /> {/* Send to server */}
            <input type="hidden" name="published" value={published.toString()} />

            <Card className="glass-card border-border">
                <CardContent className="pt-6 space-y-6">
                    <div className="space-y-4">
                        <Label>Project Cover Image</Label>
                        <ImageUpload value={coverImage} onChange={setCoverImage} />
                    </div>

                    <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-background/50">
                        <div className="space-y-0.5">
                            <Label className="text-base font-medium">Publish Status</Label>
                            <p className="text-sm text-muted-foreground">Make this case study visible on the public website.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="publish-toggle" className="text-sm cursor-pointer">{published ? "Published" : "Draft"}</Label>
                            <Button 
                                type="button" 
                                variant={published ? "default" : "secondary"}
                                onClick={() => setPublished(!published)}
                                className={published ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}
                            >
                                {published ? "Visible" : "Hidden"}
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Project Title</Label>
                            <Input
                                name="title"
                                defaultValue={initialData?.title}
                                placeholder="e.g. Redesign for TechCorp"
                                className="bg-card border-border text-foreground"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Client Name</Label>
                            <Input
                                name="clientName"
                                defaultValue={initialData?.clientName || ""}
                                placeholder="e.g. TechCorp Inc."
                                className="bg-card border-border text-foreground"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Slug (Optional)</Label>
                        <Input
                            name="slug"
                            defaultValue={initialData?.slug}
                            placeholder="redesign-techcorp"
                            className="bg-card border-border text-foreground"
                        />
                        <p className="text-xs text-muted-foreground">Leave blank to auto-generate from title.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Short Description (Excerpt)</Label>
                        <Textarea
                            name="description"
                            defaultValue={initialData?.description || ""}
                            placeholder="A brief summary shown on the card..."
                            className="bg-card border-border text-foreground"
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
                {initialData && (
                    <Button type="button" variant="outline" asChild>
                        <a href={`/projects/${initialData.slug}`} target="_blank" rel="noopener noreferrer">
                            Live Preview
                        </a>
                    </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" disabled={isPending} className="bg-primary text-black font-semibold hover:bg-primary/90">
                    {isPending ? "Saving..." : (initialData ? "Update Project" : "Create Project")}
                </Button>
            </div>
        </form>
    );
}
