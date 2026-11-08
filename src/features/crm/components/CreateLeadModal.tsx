"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createLead } from "@/features/crm/actions";
import { getPublishedServices } from "@/features/crm/actions/submit-intake";
import { CONTACT_PREFERENCES, INDUSTRY_OPTIONS, URGENCY_OPTIONS } from "@/components/public/ServiceCardItem";
import { STANDARD_LEAD_SOURCES } from "@/lib/schemas";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

interface AssignableUser {
    id: string;
    name: string | null;
    role?: string | null;
}

interface CreateLeadModalProps {
    children?: React.ReactNode;
    assignableUsers?: AssignableUser[];
}

// A lead Sales adds by hand never comes from the website or the portal.
const MANUAL_SOURCES = STANDARD_LEAD_SOURCES.filter((s) => s !== "Website Form" && s !== "Client Intake Portal");
const DEFAULT_SOURCE = "Inbound Phone / Direct Email";

const labelClass = "text-sm font-medium text-foreground";
const triggerClass = "h-9 w-full text-sm";

/**
 * "New opportunity" on the pipeline: a lead that came in by phone, referral or walk-in.
 * Same fields as the website inquiry (spec step 1); no budget and no score.
 */
export function CreateLeadModal({ children, assignableUsers = [] }: CreateLeadModalProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [services, setServices] = useState<{ id: string; title: string }[]>([]);
    const [source, setSource] = useState<string>(DEFAULT_SOURCE);
    const salesUsers = assignableUsers.filter((u) => u.role === "sales");

    useEffect(() => {
        if (open && services.length === 0) getPublishedServices().then(setServices);
    }, [open, services.length]);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const get = (k: string) => (fd.get(k) as string | null)?.trim() || undefined;

        setIsLoading(true);
        const res = await createLead({
            businessName: get("businessName") ?? "",
            contactName: get("contactName"),
            contactEmail: get("contactEmail") ?? "",
            contactPhone: get("contactPhone"),
            serviceId: get("serviceId"),
            industry: get("industry"),
            roleInCompany: get("roleInCompany"),
            urgency: get("urgency"),
            contactPreference: get("contactPreference"),
            details: get("details"),
            source: source === "Other" ? get("customSource")?.slice(0, 40) || "Other" : source,
            assignedRepId: get("owner") ?? "unassigned",
            tasksPlaybook: [],
        });
        setIsLoading(false);

        if (res.success) {
            toast.success(`${get("businessName")} is in New lead.`);
            form.reset();
            setSource(DEFAULT_SOURCE);
            setOpen(false);
        } else {
            toast.error(res.message || "Could not add this lead");
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button className="gap-1.5 font-semibold active:scale-[0.97]">
                        <Plus className="size-4" aria-hidden="true" /> New Opportunity
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card text-foreground sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold tracking-tight">New opportunity</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        For a lead that came in by phone, referral or walk-in. It starts in New lead, like an inquiry from the website.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={onSubmit} className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="businessName" className={labelClass}>Business name</Label>
                            <Input id="businessName" name="businessName" required maxLength={120} autoComplete="organization" className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="contactName" className={labelClass}>Client name <span className="font-normal text-muted-foreground">(optional)</span></Label>
                            <Input id="contactName" name="contactName" maxLength={120} autoComplete="name" className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="contactEmail" className={labelClass}>Email</Label>
                            <Input id="contactEmail" name="contactEmail" type="email" required autoComplete="email" className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="contactPhone" className={labelClass}>Phone <span className="font-normal text-muted-foreground">(optional)</span></Label>
                            <Input id="contactPhone" name="contactPhone" type="tel" autoComplete="tel" placeholder="+63 912 345 6789" className="h-9 text-sm" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="serviceId" className={labelClass}>Service</Label>
                            <Select name="serviceId">
                                <SelectTrigger id="serviceId" className={triggerClass}>
                                    <SelectValue placeholder={services.length ? "Choose a service" : "Loading services"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {services.map((s) => (
                                        <SelectItem key={s.id} value={s.id} className="text-sm">{s.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="urgency" className={labelClass}>Urgency</Label>
                            <Select name="urgency" defaultValue="Within 1 month">
                                <SelectTrigger id="urgency" className={triggerClass}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {URGENCY_OPTIONS.map((u) => (
                                        <SelectItem key={u} value={u} className="text-sm">{u}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="industry" className={labelClass}>Industry</Label>
                            <Select name="industry">
                                <SelectTrigger id="industry" className={triggerClass}>
                                    <SelectValue placeholder="Choose an industry" />
                                </SelectTrigger>
                                <SelectContent>
                                    {INDUSTRY_OPTIONS.map((i) => (
                                        <SelectItem key={i} value={i} className="text-sm">{i}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="roleInCompany" className={labelClass}>Role in the company</Label>
                            <Input id="roleInCompany" name="roleInCompany" maxLength={80} placeholder="e.g. Owner" className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="contactPreference" className={labelClass}>Preferred contact</Label>
                            <Select name="contactPreference" defaultValue="Email">
                                <SelectTrigger id="contactPreference" className={triggerClass}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CONTACT_PREFERENCES.map((c) => (
                                        <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="source" className={labelClass}>How they found us</Label>
                            <Select value={source} onValueChange={setSource}>
                                <SelectTrigger id="source" className={triggerClass}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MANUAL_SOURCES.map((s) => (
                                        <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {source === "Other" && (
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="customSource" className={labelClass}>Where from?</Label>
                                <Input id="customSource" name="customSource" required maxLength={40} placeholder="e.g. Tech Expo 2026" className="h-9 text-sm" autoFocus />
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="details" className={labelClass}>Project details</Label>
                        <Textarea id="details" name="details" rows={3} maxLength={5000} placeholder="What they want built, and anything they already told you." className="text-sm" />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="owner" className={labelClass}>Owner</Label>
                        <Select name="owner" defaultValue="unassigned">
                            <SelectTrigger id="owner" className={triggerClass}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassigned" className="text-sm">Unassigned</SelectItem>
                                {salesUsers.map((u) => (
                                    <SelectItem key={u.id} value={u.id} className="text-sm">{u.name || "Sales"}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">Unassigned leads can be claimed by any Sales user.</p>
                    </div>

                    <DialogFooter className="gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading} className="h-9 text-sm">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading} className="h-9 gap-1.5 font-semibold active:scale-[0.97]">
                            {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                            {isLoading ? "Adding" : "Add to pipeline"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
