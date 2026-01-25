"use client";

import { updateSiteSettings } from "@/features/cms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState } from "react";
import { toast } from "sonner";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SiteSettings {
    heroTitle: string | null;
    heroDescription: string | null;
    aboutText: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    contactEmail: string | null;
}

export function SettingsForm({ initialData }: { initialData: SiteSettings | undefined }) {
    const [state, formAction, isPending] = useActionState(updateSiteSettings, { message: "", success: false });

    useEffect(() => {
        if (state.message) {
            if (state.success) toast.success(state.message);
            else toast.error(state.message);
        }
    }, [state]);

    return (
        <form action={formAction} className="space-y-8">
            <Card className="bg-black/40 border-primary/20">
                <CardHeader>
                    <CardTitle>Hero Section</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Hero Title</Label>
                        <Input name="heroTitle" defaultValue={initialData?.heroTitle ?? ""} className="bg-white/5 border-white/10" />
                    </div>
                    <div className="space-y-2">
                        <Label>Hero Description</Label>
                        <Textarea name="heroDescription" defaultValue={initialData?.heroDescription ?? ""} className="bg-white/5 border-white/10" />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-black/40 border-primary/20">
                <CardHeader>
                    <CardTitle>About Section</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>About Text</Label>
                        <Textarea name="aboutText" defaultValue={initialData?.aboutText ?? ""} className="min-h-[150px] bg-white/5 border-white/10" />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-black/40 border-primary/20">
                <CardHeader>
                    <CardTitle>Branding & Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Logo URL</Label>
                            <Input name="logoUrl" defaultValue={initialData?.logoUrl ?? ""} className="bg-white/5 border-white/10" />
                        </div>
                        <div className="space-y-2">
                            <Label>Favicon URL</Label>
                            <Input name="faviconUrl" defaultValue={initialData?.faviconUrl ?? ""} className="bg-white/5 border-white/10" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Contact Email</Label>
                        <Input name="contactEmail" defaultValue={initialData?.contactEmail ?? ""} className="bg-white/5 border-white/10" />
                    </div>
                </CardContent>
            </Card>

            <Button type="submit" size="lg" disabled={isPending} className="w-full bg-primary text-black font-bold">
                {isPending ? "Saving..." : "Save Changes"}
            </Button>
        </form>
    );
}
