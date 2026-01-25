"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MapPin, Phone, Loader2 } from "lucide-react";
import { submitContactForm, type ContactState } from "@/actions/contact";

// Initial state for the form action
const initialState: ContactState = {
    message: "",
    errors: {},
    success: false,
}

export default function ContactPage() {
    const [state, formAction, isPending] = useActionState(submitContactForm, initialState);

    return (
        <div className="container mx-auto px-4 py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

                {/* Contact Info (Static) */}
                <div>
                    <h1 className="text-5xl font-bold mb-6 tracking-tight">Let&apos;s Build Something <span className="text-primary text-glow">Great</span></h1>
                    <p className="text-xl text-muted-foreground mb-12">
                        We&apos;d love to hear from you. Please fill out this form or shoot us an email.
                    </p>

                    <div className="space-y-8">
                        <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <Mail className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-1">Email Us</h3>
                                <p className="text-muted-foreground">hello@optrizo.com</p>
                                <p className="text-muted-foreground">careers@optrizo.com</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <MapPin className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-1">Visit Us</h3>
                                <p className="text-muted-foreground">
                                    123 Innovation Drive<br />
                                    Tech Valley, CA 94043
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <Phone className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-1">Call Us</h3>
                                <p className="text-muted-foreground">+1 (555) 123-4567</p>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Contact Form (Connected) */}
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
            </div>
        </div>
    );
}
