"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { submitContactForm, type ContactState } from "@/features/crm/actions/submit-lead";

const initialState: ContactState = {
    message: "",
    errors: {},
    success: false,
}

interface ServiceOption {
    id: string;
    title: string;
}

export function ContactForm({ availableServices }: { availableServices: ServiceOption[] }) {
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

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="service">Service Type</Label>
                            <select
                                id="service"
                                name="service"
                                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="" className="bg-black">Select a service...</option>
                                {availableServices.length > 0 ? (
                                    availableServices.map((service) => (
                                        <option key={service.id} value={service.title} className="bg-black">
                                            {service.title}
                                        </option>
                                    ))
                                ) : (
                                    <option value="General Inquiry" className="bg-black">General Inquiry</option>
                                )}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="budget">Budget Range</Label>
                            <select
                                id="budget"
                                name="budget"
                                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="" className="bg-black">Select a budget...</option>
                                <option value="<$1k" className="bg-black">&lt; $1k</option>
                                <option value="$1k - $5k" className="bg-black">$1k - $5k</option>
                                <option value="$5k - $10k" className="bg-black">$5k - $10k</option>
                                <option value="$10k+" className="bg-black">$10k+</option>
                            </select>
                        </div>
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
