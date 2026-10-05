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
import { Plus, X, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SiteSettings {
    heroTitle?: string | null;
    heroDescription?: string | null;
    aboutText?: string | null;
    logoUrl?: string | null;
    logoDarkUrl?: string | null;
    faviconUrl?: string | null;
    contactEmail?: string | null;
    notificationEmails?: string[] | string | null;
    demoVideoUrl?: string | null;
    faqs?: any;
}

export function SettingsForm({ initialData }: { initialData: SiteSettings | undefined }) {
    const [state, formAction, isPending] = useActionState(updateSiteSettings, { message: "", success: false });

    // Image States
    const [logo, setLogo] = useState(initialData?.logoUrl || "");
    const [logoDark, setLogoDark] = useState(initialData?.logoDarkUrl || "");
    const [favicon, setFavicon] = useState(initialData?.faviconUrl || "");
    const [aboutText, setAboutText] = useState(initialData?.aboutText || "<p>We are a team of passionate developers...</p>");

    // Email List States
    const [emails, setEmails] = useState<string[]>(() => {
        if (!initialData?.notificationEmails) return [];
        if (Array.isArray(initialData.notificationEmails)) return initialData.notificationEmails;
        if (typeof initialData.notificationEmails === "string") {
            return initialData.notificationEmails.split(",").map(e => e.trim()).filter(Boolean);
        }
        return [];
    });
    const [currEmail, setCurrEmail] = useState("");

    // FAQs State
    const [faqs, setFaqs] = useState<{question: string, answer: string}[]>(() => {
        if (!initialData?.faqs) return [];
        if (typeof initialData.faqs === "string") {
            try {
                const parsed = JSON.parse(initialData.faqs);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        }
        if (Array.isArray(initialData.faqs)) return initialData.faqs;
        return [];
    });

    const handleAddFaq = () => {
        if (faqs.length >= 10) {
            toast.error("Maximum of 10 FAQs allowed.");
            return;
        }
        setFaqs([...faqs, { question: "", answer: "" }]);
    };

    const handleRemoveFaq = (index: number) => {
        setFaqs(faqs.filter((_, i) => i !== index));
    };

    const updateFaq = (index: number, field: "question" | "answer", value: string) => {
        const newFaqs = [...faqs];
        newFaqs[index][field] = value;
        setFaqs(newFaqs);
    };

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
            <Card className="glass-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground">Hero Section</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-foreground">Hero Title</Label>
                        <Input name="heroTitle" defaultValue={initialData?.heroTitle ?? ""} className="bg-card border-border text-foreground" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground">Hero Description</Label>
                        <Textarea name="heroDescription" defaultValue={initialData?.heroDescription ?? ""} className="bg-card border-border text-foreground" />
                    </div>
                </CardContent>
            </Card>

            <Card className="glass-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground">Homepage Demo Video</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Paste a video embed URL to display in the scroll animation section below the hero. Supports YouTube embed URLs (<code className="text-primary font-mono">https://www.youtube.com/embed/VIDEO_ID</code>), Vimeo embed URLs, or a direct <code className="text-primary font-mono">.mp4</code> link.
                    </p>
                    <div className="space-y-2">
                        <Label className="text-foreground">Video Embed URL</Label>
                        <Input
                            name="demoVideoUrl"
                            defaultValue={initialData?.demoVideoUrl ?? ""}
                            className="bg-card border-border text-foreground"
                            placeholder="https://www.youtube.com/embed/..."
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className="glass-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground">About Section</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-foreground">About Text</Label>
                        <Editor content={aboutText} onChange={setAboutText} />
                        <input type="hidden" name="aboutText" value={aboutText} />
                    </div>
                </CardContent>
            </Card>

            <Card className="glass-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground">Branding & Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label className="text-foreground">Logo (Light Mode)</Label>
                            {/* Hidden Input to send data to server action */}
                            <input type="hidden" name="logoUrl" value={logo} />
                            <ImageUpload value={logo} onChange={setLogo} label="Upload Light Logo" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Logo (Dark Mode)</Label>
                            <input type="hidden" name="logoDarkUrl" value={logoDark} />
                            <ImageUpload value={logoDark} onChange={setLogoDark} label="Upload Dark Logo" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Favicon</Label>
                            <input type="hidden" name="faviconUrl" value={favicon} />
                            <ImageUpload value={favicon} onChange={setFavicon} label="Upload Favicon" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-foreground">Public Contact Email</Label>
                        <Input name="contactEmail" defaultValue={initialData?.contactEmail ?? ""} className="bg-card border-border text-foreground" />
                    </div>

                    <div className="space-y-3 pt-4 border-t border-border">
                        <Label className="text-base text-foreground">Alert Emails</Label>
                        <p className="text-xs text-muted-foreground">These addresses will receive alerts for new Contact Form submissions.</p>

                        <input type="hidden" name="notificationEmails" value={emails.join(",")} />

                        <div className="flex gap-2">
                            <Input
                                value={currEmail}
                                onChange={(e) => setCurrEmail(e.target.value)}
                                placeholder="Add recipient email..."
                                className="bg-card border-border text-foreground"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddEmail();
                                    }
                                }}
                            />
                            <Button type="button" onClick={handleAddEmail} variant="secondary" className="border-border">
                                <Plus className="h-4 w-4 mr-2" /> Add
                            </Button>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-2">
                            {emails.map((email) => (
                                <Badge key={email} variant="outline" className="pl-2 pr-1 py-1 flex items-center gap-1 border-border bg-muted/40 text-foreground">
                                    {email}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveEmail(email)}
                                        className="hover:bg-destructive/20 hover:text-destructive rounded-full p-0.5 transition-colors"
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

            <Card className="glass-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground">Frequently Asked Questions (FAQs)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <input type="hidden" name="faqs" value={JSON.stringify(faqs)} />
                    {faqs.map((faq, index) => (
                        <div key={index} className="flex gap-4 items-start border border-border p-4 rounded-lg bg-muted/10">
                            <div className="flex-1 space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-foreground">Question</Label>
                                    <Input
                                        value={faq.question}
                                        onChange={(e) => updateFaq(index, "question", e.target.value)}
                                        placeholder="e.g. How much does a custom website cost?"
                                        className="bg-card border-border text-foreground"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-foreground">Answer</Label>
                                    <Textarea
                                        value={faq.answer}
                                        onChange={(e) => updateFaq(index, "answer", e.target.value)}
                                        placeholder="e.g. It depends on the scope..."
                                        className="bg-card border-border text-foreground h-20"
                                    />
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveFaq(index)}
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                    {faqs.length < 10 && (
                        <Button type="button" onClick={handleAddFaq} variant="outline" className="w-full border-dashed">
                            <Plus className="h-4 w-4 mr-2" /> Add FAQ
                        </Button>
                    )}
                </CardContent>
            </Card>

            <Button type="submit" size="lg" disabled={isPending} className="w-full bg-primary text-black font-bold hover:bg-primary/90">
                {isPending ? "Saving..." : "Save Changes"}
            </Button>
        </form>
    );
}
