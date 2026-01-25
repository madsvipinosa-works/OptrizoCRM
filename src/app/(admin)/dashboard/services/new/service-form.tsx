"use client";

import { createService, updateService } from "@/features/cms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

interface ServiceFormProps {
    initialData?: {
        id: string;
        title: string;
        description: string;
        icon: string | null;
    };
}

export function ServiceForm({ initialData }: ServiceFormProps) {
    const action = initialData ? updateService : createService;
    const [state, formAction, isPending] = useActionState(action, { message: "", success: false });
    const router = useRouter();

    useEffect(() => {
        if (state.message) {
            if (state.success) {
                toast.success(state.message);
                router.push("/dashboard/services");
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
                            <Label>Service Title</Label>
                            <Input
                                name="title"
                                defaultValue={initialData?.title}
                                placeholder="e.g. Web Development"
                                className="bg-white/5 border-white/10"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>
                                Icon Name
                                <a
                                    href="https://lucide.dev/icons"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ml-2 text-xs text-primary underline inline-flex items-center"
                                >
                                    Browse Icons <ExternalLink className="ml-1 h-3 w-3" />
                                </a>
                            </Label>
                            <Input
                                name="icon"
                                defaultValue={initialData?.icon || "Code"}
                                placeholder="e.g. Code, Smartphone, Rocket"
                                className="bg-white/5 border-white/10"
                            />
                            <p className="text-xs text-muted-foreground">Type the exact name from Lucide Icons.</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                            name="description"
                            defaultValue={initialData?.description}
                            placeholder="Describe the service offering..."
                            className="bg-white/5 border-white/10"
                            required
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
                <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" disabled={isPending} className="bg-primary text-black font-bold">
                    {isPending ? "Saving..." : (initialData ? "Update Service" : "Create Service")}
                </Button>
            </div>
        </form>
    );
}
