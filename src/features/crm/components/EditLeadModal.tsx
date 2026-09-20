"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { updateLead } from "@/features/crm/actions";
import { toast } from "sonner";
import { Edit3, Loader2, DollarSign, Building2, User, Phone, Mail, Flame, Zap, Snowflake } from "lucide-react";
import type { LeadItem } from "./LeadsDataTable";

interface EditLeadModalProps {
    lead: LeadItem | null;
    isOpen: boolean;
    onClose: () => void;
    onLeadUpdated?: (updatedFields: Partial<LeadItem> & { id: string }) => void;
}

export function EditLeadModal({
    lead,
    isOpen,
    onClose,
    onLeadUpdated,
}: EditLeadModalProps) {
    const [isLoading, setIsLoading] = useState(false);

    // Form state
    const [businessName, setBusinessName] = useState("");
    const [contactName, setContactName] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [estimatedValue, setEstimatedValue] = useState<string>("0");
    const [budget, setBudget] = useState("");
    const [industry, setIndustry] = useState("");
    const [timelineExpectation, setTimelineExpectation] = useState("");
    const [priority, setPriority] = useState<"Hot" | "Warm" | "Cold">("Warm");
    const [leadScore, setLeadScore] = useState<string>("50");
    const [goals, setGoals] = useState("");

    // Populate when lead changes
    useEffect(() => {
        if (lead) {
            setBusinessName(lead.businessName || "");
            setContactName(lead.contactName || lead.client?.name || "");
            setContactEmail(lead.contactEmail || lead.client?.email || "");
            setContactPhone(lead.contactPhone || "");
            setEstimatedValue(String(lead.estimatedValue || 0));
            setBudget(lead.budget || "");
            setIndustry(lead.industry || "");
            setTimelineExpectation(lead.timelineExpectation || "");
            setPriority((lead.priority as any) || "Warm");
            setLeadScore(String(lead.leadScore ?? 50));
            setGoals(lead.goals || "");
        }
    }, [lead]);

    if (!lead) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const parsedValue = parseInt(estimatedValue, 10) || 0;
        const parsedScore = Math.min(100, Math.max(0, parseInt(leadScore, 10) || 50));

        try {
            const res = await updateLead(lead.id, {
                businessName: businessName.trim() || undefined,
                contactName: contactName.trim() || undefined,
                contactEmail: contactEmail.trim() || undefined,
                contactPhone: contactPhone.trim() || undefined,
                estimatedValue: parsedValue,
                budget: budget.trim() || undefined,
                industry: industry.trim() || undefined,
                timelineExpectation: timelineExpectation.trim() || undefined,
                priority,
                leadScore: parsedScore,
                score: parsedScore,
                goals: goals.trim() || undefined,
            });

            if (res.success) {
                toast.success("Deal updated successfully");
                onLeadUpdated?.({
                    id: lead.id,
                    businessName: businessName.trim() || null,
                    contactName: contactName.trim() || null,
                    contactEmail: contactEmail.trim() || null,
                    contactPhone: contactPhone.trim() || null,
                    estimatedValue: parsedValue,
                    budget: budget.trim() || null,
                    industry: industry.trim() || null,
                    timelineExpectation: timelineExpectation.trim() || null,
                    priority,
                    leadScore: parsedScore,
                    goals: goals.trim() || null,
                });
                onClose();
            } else {
                toast.error(res.message || "Failed to update deal");
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred while updating deal");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-[560px] bg-card border-border text-foreground shadow-2xl rounded-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="space-y-1 pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2 text-primary text-xs font-semibold">
                        <Edit3 className="h-4 w-4" /> Edit Opportunity
                    </div>
                    <DialogTitle className="text-xl font-bold text-foreground">
                        {lead.businessName || lead.contactName || "Opportunity Details"}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Update deal parameters, commercial financials, and contact coordinates.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    {/* Company & Contact Names */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-businessName" className="text-xs font-medium text-foreground">
                                Company / Business Name
                            </Label>
                            <Input
                                id="edit-businessName"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                placeholder="Acme Studios"
                                className="h-8 text-xs bg-muted/30 border-border text-foreground"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-contactName" className="text-xs font-medium text-foreground">
                                Primary Contact Name
                            </Label>
                            <Input
                                id="edit-contactName"
                                value={contactName}
                                onChange={(e) => setContactName(e.target.value)}
                                placeholder="Jane Doe"
                                className="h-8 text-xs bg-muted/30 border-border text-foreground"
                            />
                        </div>
                    </div>

                    {/* Email & Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-contactEmail" className="text-xs font-medium text-foreground">
                                Contact Email
                            </Label>
                            <Input
                                id="edit-contactEmail"
                                type="email"
                                value={contactEmail}
                                onChange={(e) => setContactEmail(e.target.value)}
                                placeholder="jane@acme.com"
                                className="h-8 text-xs bg-muted/30 border-border text-foreground"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-contactPhone" className="text-xs font-medium text-foreground">
                                Phone Number
                            </Label>
                            <Input
                                id="edit-contactPhone"
                                value={contactPhone}
                                onChange={(e) => setContactPhone(e.target.value)}
                                placeholder="+1 (555) 000-0000"
                                className="h-8 text-xs bg-muted/30 border-border text-foreground"
                            />
                        </div>
                    </div>

                    {/* Estimated Value ($) & Budget */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-estimatedValue" className="text-xs font-medium text-foreground flex items-center gap-1">
                                <DollarSign className="h-3 w-3 text-emerald-500" /> Estimated Value ($)
                            </Label>
                            <Input
                                id="edit-estimatedValue"
                                type="number"
                                min="0"
                                step="500"
                                value={estimatedValue}
                                onChange={(e) => setEstimatedValue(e.target.value)}
                                className="h-8 text-xs bg-muted/30 border-border text-foreground font-mono font-bold text-emerald-500 dark:text-emerald-400"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-budget" className="text-xs font-medium text-foreground">
                                Budget Range
                            </Label>
                            <Input
                                id="edit-budget"
                                value={budget}
                                onChange={(e) => setBudget(e.target.value)}
                                placeholder="e.g. $10k - $25k"
                                className="h-8 text-xs bg-muted/30 border-border text-foreground"
                            />
                        </div>
                    </div>

                    {/* Industry & Timeline */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-industry" className="text-xs font-medium text-foreground">
                                Industry / Focus
                            </Label>
                            <Input
                                id="edit-industry"
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                placeholder="e.g. Fintech, SaaS, Healthcare"
                                className="h-8 text-xs bg-muted/30 border-border text-foreground"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-timeline" className="text-xs font-medium text-foreground">
                                Timeline Urgency
                            </Label>
                            <Input
                                id="edit-timeline"
                                value={timelineExpectation}
                                onChange={(e) => setTimelineExpectation(e.target.value)}
                                placeholder="e.g. Immediate / Q3"
                                className="h-8 text-xs bg-muted/30 border-border text-foreground"
                            />
                        </div>
                    </div>

                    {/* Priority & Lead Score */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-foreground">Priority Rating</Label>
                            <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                                <SelectTrigger className="h-8 text-xs bg-muted/30 border-border text-foreground">
                                    <SelectValue placeholder="Priority" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground text-xs">
                                    <SelectItem value="Hot">🔥 Hot</SelectItem>
                                    <SelectItem value="Warm">⚡ Warm</SelectItem>
                                    <SelectItem value="Cold">❄️ Cold</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-leadScore" className="text-xs font-medium text-foreground">
                                Lead Score (0 - 100)
                            </Label>
                            <Input
                                id="edit-leadScore"
                                type="number"
                                min="0"
                                max="100"
                                value={leadScore}
                                onChange={(e) => setLeadScore(e.target.value)}
                                className="h-8 text-xs bg-muted/30 border-border text-foreground font-mono"
                            />
                        </div>
                    </div>

                    {/* Goals / Requirements */}
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-goals" className="text-xs font-medium text-foreground">
                            Project Goals & Commercial Scope
                        </Label>
                        <Textarea
                            id="edit-goals"
                            rows={3}
                            value={goals}
                            onChange={(e) => setGoals(e.target.value)}
                            placeholder="Client objectives, pain points, technical scope..."
                            className="text-xs bg-muted/30 border-border text-foreground resize-none leading-relaxed"
                        />
                    </div>

                    <DialogFooter className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="h-8 text-xs text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={isLoading}
                            className="h-8 text-xs bg-primary text-black font-semibold hover:bg-primary/90"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving...
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
