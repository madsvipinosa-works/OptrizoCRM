"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createLead } from "@/features/crm/actions";
import { toast } from "sonner";
import { Plus, UserPlus, Loader2 } from "lucide-react";

const LEAD_SOURCES = [
    "Website Form",
    "LinkedIn",
    "Referral",
    "Cold Outreach (Email/Call)",
    "Networking / Event",
    "Existing Client (Upsell)",
    "Other"
];

export function CreateLeadModal({ children }: { children?: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        const formData = new FormData(e.currentTarget);

        const businessName = formData.get("businessName") as string;
        const contactName = formData.get("contactName") as string;
        const contactEmail = formData.get("contactEmail") as string;
        const contactPhone = formData.get("contactPhone") as string;
        const source = formData.get("source") as string;
        const industry = formData.get("industry") as string;
        const budget = formData.get("budget") as string;
        const goals = formData.get("goals") as string;
        const timelineExpectation = formData.get("timeline") as string;

        const res = await createLead({
            businessName: businessName || contactName,
            contactName: contactName || undefined,
            contactEmail,
            contactPhone: contactPhone || undefined,
            industry: industry || undefined,
            source: source || "Manual Entry",
            budget: budget || undefined,
            timelineExpectation: timelineExpectation || undefined,
            goals: goals || undefined,
        });

        setIsLoading(false);

        if (res.success) {
            toast.success(res.message || "Opportunity created successfully");
            setOpen(false);
        } else {
            toast.error(res.message || "Failed to create opportunity");
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button className="bg-primary text-black hover:bg-primary/90 font-semibold gap-1.5 shadow-lg shadow-primary/20">
                        <Plus className="h-4 w-4" /> New Opportunity
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-white/10 text-white shadow-2xl">
                <DialogHeader className="space-y-1">
                    <div className="flex items-center gap-2 text-primary text-xs font-semibold">
                        <UserPlus className="h-4 w-4" /> CRM Pipeline Intake
                    </div>
                    <DialogTitle className="text-xl font-bold">Add New Deal / Lead</DialogTitle>
                    <DialogDescription className="text-xs text-zinc-400">
                        Create a qualified sales opportunity directly in the pipeline with automated scoring.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={onSubmit} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="businessName" className="text-xs">Company / Business <span className="text-primary">*</span></Label>
                            <Input
                                id="businessName"
                                name="businessName"
                                placeholder="Acme Studios"
                                required
                                className="bg-zinc-900 border-white/10 text-xs h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="contactName" className="text-xs">Contact Person</Label>
                            <Input
                                id="contactName"
                                name="contactName"
                                placeholder="John Doe"
                                className="bg-zinc-900 border-white/10 text-xs h-9"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="contactEmail" className="text-xs">Contact Email <span className="text-primary">*</span></Label>
                            <Input
                                id="contactEmail"
                                name="contactEmail"
                                type="email"
                                placeholder="john@acme.com"
                                required
                                className="bg-zinc-900 border-white/10 text-xs h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="contactPhone" className="text-xs">Phone Number</Label>
                            <Input
                                id="contactPhone"
                                name="contactPhone"
                                type="tel"
                                placeholder="+1 555-0192"
                                className="bg-zinc-900 border-white/10 text-xs h-9"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="budget" className="text-xs">Budget / Value</Label>
                            <Input
                                id="budget"
                                name="budget"
                                placeholder="e.g. $10,000"
                                className="bg-zinc-900 border-white/10 text-xs h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="source" className="text-xs">Lead Source</Label>
                            <Select name="source" defaultValue="Website Form">
                                <SelectTrigger className="bg-zinc-900 border-white/10 text-xs h-9 text-white">
                                    <SelectValue placeholder="Source" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-white/15 text-white">
                                    {LEAD_SOURCES.map(source => (
                                        <SelectItem key={source} value={source} className="text-xs">{source}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="industry" className="text-xs">Industry / Focus</Label>
                            <Input
                                id="industry"
                                name="industry"
                                placeholder="e.g. SaaS / Ecommerce"
                                className="bg-zinc-900 border-white/10 text-xs h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="timeline" className="text-xs">Timeline Urgency</Label>
                            <Input
                                id="timeline"
                                name="timeline"
                                placeholder="e.g. Immediate / 1 Month"
                                className="bg-zinc-900 border-white/10 text-xs h-9"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="goals" className="text-xs">Project Goals / Notes</Label>
                        <Textarea
                            id="goals"
                            name="goals"
                            placeholder="Describe client requirements, objectives, or initial discovery notes..."
                            rows={2}
                            className="bg-zinc-900 border-white/10 text-xs resize-none placeholder:text-zinc-600"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            className="text-xs text-zinc-400 hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="bg-primary text-black hover:bg-primary/90 font-semibold text-xs gap-1.5"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                                </>
                            ) : (
                                "Add to Pipeline"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
