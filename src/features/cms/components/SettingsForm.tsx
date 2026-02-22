"use client";

import { updateSiteSettings } from "@/features/cms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Editor } from "@/features/cms/components/Editor";
import { useActionState, useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SiteSettings {
    heroTitle: string | null;
    heroDescription: string | null;
    aboutText: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    contactEmail: string | null;
    notificationEmails: string | null;
    monthlyMarketingSpend: number | null;
    adminHoursSavedPerProject: number | null;
}

export function SettingsForm({ initialData }: { initialData: SiteSettings | undefined }) {
    const [state, formAction, isPending] = useActionState(updateSiteSettings, { message: "", success: false });

    // Image States
    const [logo, setLogo] = useState(initialData?.logoUrl || "");
    const [favicon, setFavicon] = useState(initialData?.faviconUrl || "");
    const [aboutText, setAboutText] = useState(initialData?.aboutText || "<p>We are a team of passionate developers...</p>");

    // Email List States
    const [emails, setEmails] = useState<string[]>(
        initialData?.notificationEmails?.split(",").map(e => e.trim()).filter(Boolean) || []
    );
    const [currEmail, setCurrEmail] = useState("");

    useEffect(() => {
        if (state.message) {
            if (state.success) toast.success(state.message);
            else toast.error(state.message);
        }
    }, [state]);

    const handleAddEmail = () => {
        if (!currEmail) return;
        if (!currEmail.includes("@")) {
            toast.error("Invalid email address");
            return;
        }
        if (emails.includes(currEmail)) {
            toast.error("Email already added");
            return;
        }
        setEmails([...emails, currEmail]);
        setCurrEmail("");
    };

    const handleRemoveEmail = (email: string) => {
        setEmails(emails.filter(e => e !== email));
    };

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
                        <Editor content={aboutText} onChange={setAboutText} />
                        <input type="hidden" name="aboutText" value={aboutText} />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-black/40 border-primary/20">
                <CardHeader>
                    <CardTitle>Branding & Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Logo</Label>
                            {/* Hidden Input to send data to server action */}
                            <input type="hidden" name="logoUrl" value={logo} />
                            <ImageUpload value={logo} onChange={setLogo} label="Upload Logo" />
                        </div>
                        <div className="space-y-2">
                            <Label>Favicon</Label>
                            <input type="hidden" name="faviconUrl" value={favicon} />
                            <ImageUpload value={favicon} onChange={setFavicon} label="Upload Favicon" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Public Contact Email</Label>
                        <Input name="contactEmail" defaultValue={initialData?.contactEmail ?? ""} className="bg-white/5 border-white/10" />
                    </div>

                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <Label className="text-base">Alert Emails</Label>
                        <p className="text-xs text-muted-foreground">These addresses will receive alerts for new Contact Form submissions.</p>

                        <input type="hidden" name="notificationEmails" value={emails.join(",")} />

                        <div className="flex gap-2">
                            <Input
                                value={currEmail}
                                onChange={(e) => setCurrEmail(e.target.value)}
                                placeholder="Add recipient email..."
                                className="bg-white/5 border-white/10"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddEmail();
                                    }
                                }}
                            />
                            <Button type="button" onClick={handleAddEmail} variant="secondary">
                                <Plus className="h-4 w-4 mr-2" /> Add
                            </Button>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-2">
                            {emails.map((email) => (
                                <Badge key={email} variant="outline" className="pl-2 pr-1 py-1 flex items-center gap-1 border-white/20">
                                    {email}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveEmail(email)}
                                        className="hover:bg-red-500/20 hover:text-red-400 rounded-full p-0.5 transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                            {emails.length === 0 && (
                                <span className="text-sm text-muted-foreground italic">No recipients configured.</span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-black/40 border-primary/20">
                <CardHeader>
                    <CardTitle>System Intelligence</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <p className="text-sm text-muted-foreground">Configure the variables used to accurately calculate your Return on Marketing (ROMI) and Automation ROI inside the CRM Analytics Dashboard.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Monthly Marketing Spend ($)</Label>
                            <Input
                                type="number"
                                name="monthlyMarketingSpend"
                                defaultValue={initialData?.monthlyMarketingSpend ?? 1000}
                                className="bg-white/5 border-white/10"
                                placeholder="1000"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Admin Hours Saved Per Project</Label>
                            <Input
                                type="number"
                                name="adminHoursSavedPerProject"
                                defaultValue={initialData?.adminHoursSavedPerProject ?? 2}
                                className="bg-white/5 border-white/10"
                                placeholder="2"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Button type="submit" size="lg" disabled={isPending} className="w-full bg-primary text-black font-bold">
                {isPending ? "Saving..." : "Save Changes"}
            </Button>
        </form>
    );
}
