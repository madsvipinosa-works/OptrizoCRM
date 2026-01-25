"use client";

import { createTestimonial, updateTestimonial } from "@/features/cms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

interface TestimonialFormProps {
    initialData?: {
        id: string;
        name: string;
        role: string | null;
        company: string | null;
        content: string;
        rating: number | null;
    };
}

export function TestimonialForm({ initialData }: TestimonialFormProps) {
    const action = initialData ? updateTestimonial : createTestimonial;
    const [state, formAction, isPending] = useActionState(action, { message: "", success: false });
    const router = useRouter();

    useEffect(() => {
        if (state.message) {
            if (state.success) {
                toast.success(state.message);
                router.push("/dashboard/testimonials");
            } else {
                toast.error(state.message);
            }
        }
    }, [state, router]);

    return (
        <form action={formAction} className="space-y-8">
            {initialData && <input type="hidden" name="id" value={initialData.id} />}

            <Card className="bg-black/40 border-primary/20">
                <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Client Name</Label>
                            <Input
                                name="name"
                                defaultValue={initialData?.name}
                                placeholder="e.g. John Doe"
                                className="bg-white/5 border-white/10"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Rating (1-5)</Label>
                            <Input
                                type="number"
                                min="1"
                                max="5"
                                name="rating"
                                defaultValue={initialData?.rating || 5}
                                className="bg-white/5 border-white/10"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Role (Optional)</Label>
                            <Input
                                name="role"
                                defaultValue={initialData?.role || ""}
                                placeholder="e.g. CEO"
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Company (Optional)</Label>
                            <Input
                                name="company"
                                defaultValue={initialData?.company || ""}
                                placeholder="e.g. Acme Corp"
                                className="bg-white/5 border-white/10"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Quote</Label>
                        <Textarea
                            name="content"
                            defaultValue={initialData?.content}
                            placeholder="What did they say about us?"
                            className="bg-white/5 border-white/10 min-h-[100px]"
                            required
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
                <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" disabled={isPending} className="bg-primary text-black font-bold">
                    {isPending ? "Saving..." : (initialData ? "Update Testimonial" : "Add Testimonial")}
                </Button>
            </div>
        </form>
    );
}
