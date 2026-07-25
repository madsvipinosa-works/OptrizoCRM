"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { submitIntakeForm, type IntakeState } from "@/features/crm/actions/submit-intake";
import { BUDGET_OPTIONS } from "@/lib/constants";

const initialState: IntakeState = {
    message: "",
    errors: {},
    success: false,
}

interface ServiceOption {
    id: string;
    title: string;
}

interface IntakeFormProps {
    availableServices: ServiceOption[];
    preSelectedServiceId?: string;
}

export function IntakeForm({ availableServices, preSelectedServiceId }: IntakeFormProps) {
    const [state, formAction, isPending] = useActionState(submitIntakeForm, initialState);

    return (
        <Card className="glass-card border-primary/20">
            <CardHeader>
                <CardTitle>Project Intake Form</CardTitle>
                <CardDescription>Provide details about your business and goals to help us create a tailored proposal.</CardDescription>
            </CardHeader>
            <CardContent>
                <form action={formAction} className="space-y-6">
                    {state?.message && (
                        <div className={`p-3 rounded-md text-sm ${state.success ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                            {state.message}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="businessName">Business / Company Name</Label>
                        <Input id="businessName" name="businessName" placeholder="Acme Corp" className="bg-white/5 border-white/10" />
                        {state?.errors?.businessName && (
                            <p className="text-sm text-red-500">{state.errors.businessName[0]}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="industry">Industry</Label>
                            <Input id="industry" name="industry" placeholder="e.g. Real Estate, E-commerce" className="bg-white/5 border-white/10" />
                            {state?.errors?.industry && (
                                <p className="text-sm text-red-500">{state.errors.industry[0]}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="targetAudience">Target Audience</Label>
                            <Input id="targetAudience" name="targetAudience" placeholder="Who are your customers?" className="bg-white/5 border-white/10" />
                            {state?.errors?.targetAudience && (
                                <p className="text-sm text-red-500">{state.errors.targetAudience[0]}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="serviceId">Service of Interest</Label>
                            <select
                                id="serviceId"
                                name="serviceId"
                                defaultValue={preSelectedServiceId || ""}
                                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="" className="bg-black">Select a service...</option>
                                {availableServices.map((service) => (
                                    <option key={service.id} value={service.id} className="bg-black">
                                        {service.title}
                                    </option>
                                ))}
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
                                {BUDGET_OPTIONS.map((option) => (
                                    <option key={option} value={option} className="bg-black">
                                        {option}
                                    </option>
                                ))}
                            </select>
                            {state?.errors?.budget && (
                                <p className="text-sm text-red-500">{state.errors.budget[0]}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="timelineExpectation">Timeline Expectation</Label>
                        <select
                            id="timelineExpectation"
                            name="timelineExpectation"
                            className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="" className="bg-black">Select a timeline...</option>
                            <option value="ASAP" className="bg-black">ASAP</option>
                            <option value="1-2 months" className="bg-black">1-2 months</option>
                            <option value="3-6 months" className="bg-black">3-6 months</option>
                            <option value="Flexible" className="bg-black">Flexible</option>
                        </select>
                        {state?.errors?.timelineExpectation && (
                            <p className="text-sm text-red-500">{state.errors.timelineExpectation[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="goals">Project Goals & Description</Label>
                        <Textarea id="goals" name="goals" placeholder="What are you trying to achieve? What are the key deliverables?" className="min-h-[150px] bg-white/5 border-white/10" />
                        {state?.errors?.goals && (
                            <p className="text-sm text-red-500">{state.errors.goals[0]}</p>
                        )}
                    </div>

                    <Button type="submit" size="lg" disabled={isPending} className="w-full bg-primary text-black font-bold hover:bg-primary/90">
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit Request"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
