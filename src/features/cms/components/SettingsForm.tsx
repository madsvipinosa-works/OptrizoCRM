"use client";

import { updateSiteSettings } from "@/features/cms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState, useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { Plus, X, Trash2, HelpCircle, Sparkles, ExternalLink, Mail, ShieldCheck, ArrowRight, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface SiteSettings {
    logoUrl?: string | null;
    logoDarkUrl?: string | null;
    faviconUrl?: string | null;
    contactEmail?: string | null;
    notificationEmails?: string[] | string | null;
    faqs?: any;
}

export function SettingsForm({ initialData }: { initialData: SiteSettings | undefined }) {
    const [state, formAction, isPending] = useActionState(updateSiteSettings, { message: "", success: false });

    // Image States
    const [logo, setLogo] = useState(initialData?.logoUrl || "");
    const [logoDark, setLogoDark] = useState(initialData?.logoDarkUrl || "");
    const [favicon, setFavicon] = useState(initialData?.faviconUrl || "");

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
        <div className="space-y-8 max-w-5xl">
            {/* Quick Content Navigation Shortcuts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between gap-4 group hover:border-primary/40 transition-all">
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary shrink-0" />
                            <h4 className="text-sm font-semibold text-foreground">Homepage Hero & Media</h4>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                            Hero headline, tagline, and homepage demo video are managed in the CMS module.
                        </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="border-border text-foreground shrink-0 group-hover:border-primary/50">
                        <Link href="/dashboard/cms">
                            Open CMS <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Link>
                    </Button>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between gap-4 group hover:border-primary/40 transition-all">
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-purple-400 shrink-0" />
                            <h4 className="text-sm font-semibold text-foreground">About Section & Bento Layout</h4>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                            Company stats, mission statement, tech stack, and core values are managed in Content Manager.
                        </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="border-border text-foreground shrink-0 group-hover:border-purple-400/50">
                        <Link href="/dashboard/cms">
                            Open CMS <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Link>
                    </Button>
                </div>
            </div>

            <form action={formAction} className="space-y-8">
                {/* Branding & Contact Settings Card */}
                <Card className="glass-card border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                            Branding & System Communications
                        </CardTitle>
                        <CardDescription>
                            Configure your agency brand assets and primary notification routing channels.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label className="text-foreground font-medium">Logo (Light Mode)</Label>
                                <input type="hidden" name="logoUrl" value={logo} />
                                <ImageUpload value={logo} onChange={setLogo} label="Upload Light Logo" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-foreground font-medium">Logo (Dark Mode)</Label>
                                <input type="hidden" name="logoDarkUrl" value={logoDark} />
                                <ImageUpload value={logoDark} onChange={setLogoDark} label="Upload Dark Logo" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-foreground font-medium">Favicon</Label>
                                <input type="hidden" name="faviconUrl" value={favicon} />
                                <ImageUpload value={favicon} onChange={setFavicon} label="Upload Favicon" />
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-border">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="contactEmail" className="text-foreground font-medium">Public Contact Email</Label>
                                <span className="text-xs text-muted-foreground">Displayed on the public /contact page</span>
                            </div>
                            <Input
                                id="contactEmail"
                                name="contactEmail"
                                defaultValue={initialData?.contactEmail ?? ""}
                                placeholder="hello@optrizo.com"
                                className="bg-card border-border text-foreground"
                            />
                        </div>

                        <div className="space-y-3 pt-4 border-t border-border">
                            <div>
                                <Label className="text-base text-foreground font-medium flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-primary" />
                                    Internal Alert Recipients
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    These team email addresses will receive instant notifications when prospective clients submit the Contact or Intake form.
                                </p>
                            </div>

                            <input type="hidden" name="notificationEmails" value={emails.join(",")} />

                            <div className="flex gap-2">
                                <Input
                                    value={currEmail}
                                    onChange={(e) => setCurrEmail(e.target.value)}
                                    placeholder="Add team member email (e.g. sales@optrizo.com)..."
                                    className="bg-card border-border text-foreground"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
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
                                    <Badge key={email} variant="outline" className="pl-2.5 pr-1.5 py-1 flex items-center gap-1.5 border-border bg-muted/40 text-foreground">
                                        <span>{email}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveEmail(email)}
                                            className="hover:bg-destructive/20 hover:text-destructive rounded-full p-0.5 transition-colors"
                                            aria-label={`Remove ${email}`}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                                {emails.length === 0 && (
                                    <span className="text-xs text-muted-foreground italic">No notification recipients configured yet.</span>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Contact Page FAQs Card */}
                <Card className="glass-card border-border">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <HelpCircle className="w-5 h-5 text-primary" />
                                Contact Page Frequently Asked Questions (FAQs)
                            </CardTitle>
                            <CardDescription>
                                These questions and answers are presented in the dedicated FAQ accordion below the contact form on <code className="text-primary font-mono text-xs">/contact</code>.
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="border-border w-fit font-mono text-xs">
                            {faqs.length} / 10 FAQs
                        </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <input type="hidden" name="faqs" value={JSON.stringify(faqs)} />

                        {faqs.map((faq, index) => (
                            <div key={index} className="flex gap-4 items-start border border-border p-4 rounded-xl bg-card/60 relative group">
                                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary font-mono text-xs font-bold shrink-0 mt-1">
                                    {String(index + 1).padStart(2, "0")}
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-foreground text-xs font-semibold uppercase tracking-wider">Question</Label>
                                        <Input
                                            value={faq.question}
                                            onChange={(e) => updateFaq(index, "question", e.target.value)}
                                            placeholder="e.g. What is your typical timeline for MVP delivery?"
                                            className="bg-card border-border text-foreground text-sm font-medium"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-foreground text-xs font-semibold uppercase tracking-wider">Answer</Label>
                                        <Textarea
                                            value={faq.answer}
                                            onChange={(e) => updateFaq(index, "answer", e.target.value)}
                                            placeholder="e.g. We typically deliver enterprise MVPs within 4 to 8 weeks depending on the integrations and scope..."
                                            className="bg-card border-border text-foreground text-sm resize-none h-20"
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveFaq(index)}
                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 mt-1"
                                    title="Delete FAQ"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}

                        {faqs.length === 0 && (
                            <div className="text-center py-8 px-4 border border-dashed border-border rounded-xl bg-muted/10 space-y-2">
                                <HelpCircle className="w-8 h-8 text-muted-foreground mx-auto" />
                                <p className="text-sm font-medium text-foreground">No FAQs configured yet</p>
                                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                    Adding clear FAQs helps answer prospective client questions about timelines, scoping, and billing directly on the contact page.
                                </p>
                            </div>
                        )}

                        {faqs.length < 10 && (
                            <Button type="button" onClick={handleAddFaq} variant="outline" className="w-full border-dashed border-border hover:border-primary/50 text-foreground">
                                <Plus className="h-4 w-4 mr-2 text-primary" /> Add Frequently Asked Question
                            </Button>
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-end pt-2">
                    <Button type="submit" size="lg" disabled={isPending} className="bg-primary text-black font-bold hover:bg-primary/90 min-w-[200px] shadow-lg shadow-primary/20">
                        {isPending ? "Saving Settings..." : "Save System Settings"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
