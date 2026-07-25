"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { submitContactForm, type ContactState } from "@/features/crm/actions/submit-inquiry";

const initialState: ContactState = {
    message: "",
    errors: {},
    success: false,
}

export function ContactForm() {
    const [state, formAction, isPending] = useActionState(submitContactForm, initialState);

    return (
        <Card className="glass-card border-primary/20">
            <CardHeader>
                <CardTitle>Send a Message</CardTitle>
                <CardDescription>We usually respond within 24 hours.</CardDescription>
            </CardHeader>
            <CardContent>
                <form action={formAction} className="space-y-6">
                    {state?.message && (
                        <div className={`p-3 rounded-md text-sm ${state.success ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                            {state.message}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">First name</Label>
                            <Input id="firstName" name="firstName" placeholder="John" className="bg-white/5 border-white/10" aria-describedby="firstName-error" />
                            {state?.errors?.firstName && (
                                <p id="firstName-error" className="text-sm text-red-500">{state.errors.firstName[0]}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Last name</Label>
                            <Input id="lastName" name="lastName" placeholder="Doe" className="bg-white/5 border-white/10" aria-describedby="lastName-error" />
                            {state?.errors?.lastName && (
                                <p id="lastName-error" className="text-sm text-red-500">{state.errors.lastName[0]}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" placeholder="john@example.com" className="bg-white/5 border-white/10" aria-describedby="email-error" />
                        {state?.errors?.email && (
                            <p id="email-error" className="text-sm text-red-500">{state.errors.email[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input id="subject" name="subject" placeholder="Project Inquiry" className="bg-white/5 border-white/10" aria-describedby="subject-error" />
                        {state?.errors?.subject && (
                            <p id="subject-error" className="text-sm text-red-500">{state.errors.subject[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea id="message" name="message" placeholder="Tell us about your project..." className="min-h-[150px] bg-white/5 border-white/10" aria-describedby="message-error" />
                        {state?.errors?.message && (
                            <p id="message-error" className="text-sm text-red-500">{state.errors.message[0]}</p>
                        )}
                    </div>

                    <Button type="submit" size="lg" disabled={isPending} className="w-full bg-primary text-black font-bold hover:bg-primary/90">
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send Message"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
