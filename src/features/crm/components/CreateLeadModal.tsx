"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createInquiry } from "@/features/crm/actions";
import { toast } from "sonner";

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
        
        const res = await createInquiry({
            name: formData.get("name") as string,
            email: formData.get("email") as string,
            source: formData.get("source") as string,
            service: formData.get("service") as string,
            budget: formData.get("budget") as string,
            notes: formData.get("notes") as string,
        });

        setIsLoading(false);

        if (res.success) {
            toast.success("Inquiry created successfully");
            setOpen(false);
        } else {
            toast.error(res.message || "Failed to create inquiry");
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || <Button>Create Inquiry</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-[#0A0A0A] border-[#262626] text-white">
                <DialogHeader>
                    <DialogTitle>Add New Inquiry</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" name="name" required className="bg-[#1A1A1A] border-[#262626]" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" required className="bg-[#1A1A1A] border-[#262626]" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="source">Source</Label>
                        <Select name="source" defaultValue="Other">
                            <SelectTrigger className="bg-[#1A1A1A] border-[#262626]">
                                <SelectValue placeholder="Select Source" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1A1A1A] border-[#262626] text-white">
                                {LEAD_SOURCES.map(source => (
                                    <SelectItem key={source} value={source}>{source}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="service">Requested Service</Label>
                        <Input id="service" name="service" placeholder="e.g. Web Development" className="bg-[#1A1A1A] border-[#262626]" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="budget">Estimated Budget</Label>
                        <Input id="budget" name="budget" placeholder="e.g. $5k - $10k" className="bg-[#1A1A1A] border-[#262626]" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="notes">Internal Notes</Label>
                        <Textarea id="notes" name="notes" placeholder="Any initial details..." className="bg-[#1A1A1A] border-[#262626]" />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} className="bg-transparent border-[#262626] text-white hover:bg-[#262626]">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading} className="bg-white text-black hover:bg-zinc-200">
                            {isLoading ? "Creating..." : "Create Lead"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
