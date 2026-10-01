"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    Save,
    Send,
    Printer,
    Plus,
    Trash2,
    Sparkles,
    FileText,
    DollarSign,
    CheckCircle2,
    Calendar,
    Layers,
    Loader2,
    Eye,
    ChevronDown,
    Share2,
    Copy,
    Check,
    Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { updateProposal, sendProposalEmail, ProposalData, ContractSettings } from "@/features/proposals/actions";
import {
    ProposalDocumentSheet,
    ProposalDocumentData,
    PricingLineItem,
} from "@/features/proposals/components/ProposalDocumentSheet";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProposalBuilderStudioProps {
    proposal: {
        id: string;
        leadId: string;
        proposalCode?: string | null;
        scope?: string | null;
        deliverables?: any;
        timeline?: string | null;
        technicalApproach?: string | null;
        pricingStructure?: any;
        subtotal?: number | null;
        discount?: number | null;
        tax?: number | null;
        total?: number | null;
        terms?: string | null;
        validUntil?: Date | string | null;
        status: "Draft" | "Sent" | "Approved" | "Rejected";
        fileUrl?: string | null;
        acceptedByName?: string | null;
        acceptedByTitle?: string | null;
        acceptedAt?: Date | string | null;
        signatureData?: string | null;
        createdAt: Date | string;
        contractSettings?: ContractSettings | null;
        lead?: {
            id: string;
            businessName?: string | null;
            goals?: string | null;
            budget?: string | null;
            client?: {
                id: string;
                name: string | null;
                email: string;
            } | null;
        } | null;
    };
}

const TEMPLATES = [
    {
        name: "Full-Stack Web Application",
        scope: "Design, build, and deploy a modern Next.js SaaS platform with complete PostgreSQL database architecture, secure authentication, multi-tenant RBAC, and responsive dark/light UI.",
        technicalApproach: "Next.js (App Router), TypeScript, Tailwind CSS, Drizzle ORM with Supabase PostgreSQL, NextAuth.js, and Vercel edge deployment.",
        timeline: "6 - 8 Weeks (Agile Sprints)",
        deliverables: [
            "Figma High-Fidelity UI/UX Prototype & Design System",
            "Next.js App Router Core Frontend Architecture",
            "PostgreSQL Database Schema & Migration Pipeline",
            "Stripe / Payment Gateway Integration",
            "Automated CI/CD Deployment & Production QA",
        ],
        pricingItems: [
            { name: "UI/UX System & Interactive Wireframes", description: "Design tokens, components, and user flows", quantity: 1, unitPrice: 2500, total: 2500 },
            { name: "Full-Stack Web Development & API Architecture", description: "Frontend, backend server actions, and database", quantity: 1, unitPrice: 7500, total: 7500 },
            { name: "Production Deployment & Security Hardening", description: "Infrastructure setup, SSL, and performance optimization", quantity: 1, unitPrice: 1500, total: 1500 },
        ],
        terms: "Standard Agency Terms: 50% deposit due upon proposal acceptance to commence sprint planning. 25% upon mid-point staging milestone approval, and 25% balance due prior to final production handover.",
    },
    {
        name: "Mobile MVP (iOS & Android)",
        scope: "Cross-platform mobile application development for iOS and Android with real-time push notifications, offline syncing, and cloud API backend.",
        technicalApproach: "React Native / Expo, Node.js GraphQL API, PostgreSQL, and Firebase Cloud Messaging.",
        timeline: "8 - 10 Weeks",
        deliverables: [
            "Mobile UX Wireframes & Interactive Prototype",
            "React Native Cross-Platform Mobile App (iOS & Android)",
            "Cloud Backend API & Push Notification Pipeline",
            "App Store & Google Play Store Submission Assistance",
        ],
        pricingItems: [
            { name: "Mobile UI/UX Design System", description: "iOS and Android responsive screen mockups", quantity: 1, unitPrice: 3000, total: 3000 },
            { name: "React Native App Development", description: "Component engineering and offline state", quantity: 1, unitPrice: 8500, total: 8500 },
            { name: "Cloud Backend & App Store Publishing", description: "Cloud provisioning and store compliance", quantity: 1, unitPrice: 2000, total: 2000 },
        ],
        terms: "50% upfront retainer to initialize development sprints. 50% due upon build delivery for App Store submission.",
    },
    {
        name: "Growth Marketing & SEO Retainer",
        scope: "Comprehensive organic search engine optimization, content strategy, programmatic landing pages, and conversion rate optimization (CRO).",
        technicalApproach: "Technical SEO audits, Schema.org structured data, performance tuning, and keyword positioning tracking.",
        timeline: "3 Months Initial Commitment",
        deliverables: [
            "Comprehensive Technical SEO & Core Web Vitals Audit",
            "Competitor Analysis & High-Intent Keyword Strategy",
            "Monthly High-Authority Content Production (4 In-Depth Articles)",
            "Bi-Weekly Conversion Rate Optimization & Analytics Reporting",
        ],
        pricingItems: [
            { name: "Monthly SEO & CRO Retainer (3 Months)", description: "Complete optimization, content generation, and ranking reports", quantity: 3, unitPrice: 2000, total: 6000 },
        ],
        terms: "Monthly retainer billed automatically at the beginning of each billing cycle. 30 days written notice required for cancellation after initial commitment.",
    },
];

export function ProposalBuilderStudio({ proposal }: ProposalBuilderStudioProps) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [currentStatus, setCurrentStatus] = useState<"Draft" | "Sent" | "Approved" | "Rejected">(proposal.status);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(proposal.createdAt ? new Date(proposal.createdAt) : null);
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    const clientUrl = typeof window !== "undefined"
        ? `${window.location.origin}/proposal/${proposal.id}`
        : `/proposal/${proposal.id}`;

    // Initial state parser
    const initialDeliverables: string[] = useMemo(() => {
        if (!proposal.deliverables) return [""];
        let raw = proposal.deliverables;
        if (typeof raw === "string") {
            try {
                raw = JSON.parse(raw);
            } catch {
                return [raw];
            }
        }
        if (Array.isArray(raw)) {
            const list = raw.map((d: any) => {
                if (typeof d === "string") return d;
                if (d && typeof d === "object") {
                    return d.title ? (d.description ? `${d.title}: ${d.description}` : d.title) : (d.description || JSON.stringify(d));
                }
                return String(d || "");
            }).filter((s) => typeof s === "string" && s.trim() !== "");
            return list.length > 0 ? list : [""];
        }
        return [""];
    }, [proposal.deliverables]);

    const initialPricingItems: PricingLineItem[] = useMemo(() => {
        if (!proposal.pricingStructure) return [{ name: "", description: "", quantity: 1, unitPrice: 0, total: 0 }];
        let raw = proposal.pricingStructure;
        if (typeof raw === "string") {
            try {
                raw = JSON.parse(raw);
            } catch {
                // ignore
            }
        }
        if (typeof raw === "object" && raw !== null && "items" in raw && Array.isArray((raw as any).items)) {
            raw = (raw as any).items;
        }
        if (Array.isArray(raw)) {
            const list = raw.map((i: any) => {
                const name = i.name || i.title || i.description || "Service Item";
                const description = i.description || "";
                const quantity = Number(i.quantity) || 1;
                const unitPrice = Number(i.unitPrice ?? i.amount ?? i.price) || 0;
                const total = Number(i.total) || quantity * unitPrice;
                return { name, description, quantity, unitPrice, total };
            });
            return list.length > 0 ? list : [{ name: "", description: "", quantity: 1, unitPrice: 0, total: 0 }];
        }
        return [{ name: "", description: "", quantity: 1, unitPrice: 0, total: 0 }];
    }, [proposal.pricingStructure]);

    // Form states
    const [proposalCode, setProposalCode] = useState(
        proposal.proposalCode || `OPT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    );
    const [businessName, setBusinessName] = useState(
        proposal.lead?.businessName || proposal.lead?.client?.name || "Valued Client"
    );
    const [scope, setScope] = useState(proposal.scope || "");
    const [technicalApproach, setTechnicalApproach] = useState(proposal.technicalApproach || "");
    const [deliverables, setDeliverables] = useState<string[]>(initialDeliverables);
    const [timeline, setTimeline] = useState(proposal.timeline || "4 - 6 Weeks");
    const [pricingItems, setPricingItems] = useState<PricingLineItem[]>(initialPricingItems);
    const [discount, setDiscount] = useState<number>(Number(proposal.discount) || 0);
    const [tax, setTax] = useState<number>(Number(proposal.tax) || 0);
    const [terms, setTerms] = useState(
        proposal.terms ||
            "Standard agency terms apply: 50% deposit required upon acceptance to initiate sprint planning, with the remaining balance due upon milestone handover."
    );
    const [validUntil, setValidUntil] = useState<string>(
        proposal.validUntil
            ? new Date(proposal.validUntil).toISOString().split("T")[0]
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    );
    const [contractSettings, setContractSettings] = useState<ContractSettings>(
        (proposal.contractSettings as ContractSettings) || {}
    );
    const [showContractSettings, setShowContractSettings] = useState(false);

    const updateCS = (key: keyof ContractSettings, value: any) =>
        setContractSettings((prev) => ({ ...prev, [key]: value }));

    // Dynamic Calculations
    const subtotal = useMemo(() => {
        return pricingItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    }, [pricingItems]);

    const grandTotal = useMemo(() => {
        return Math.max(0, subtotal - discount + tax);
    }, [subtotal, discount, tax]);

    // Deliverable controls
    const addDeliverable = () => setDeliverables([...deliverables, ""]);
    const removeDeliverable = (index: number) => setDeliverables(deliverables.filter((_, i) => i !== index));
    const updateDeliverable = (index: number, val: string) => {
        const next = [...deliverables];
        next[index] = val;
        setDeliverables(next);
    };

    // Pricing item controls
    const addPricingItem = () => {
        setPricingItems([
            ...pricingItems,
            { name: "", description: "", quantity: 1, unitPrice: 0, total: 0 },
        ]);
    };
    const removePricingItem = (index: number) => {
        setPricingItems(pricingItems.filter((_, i) => i !== index));
    };
    const updatePricingItem = (index: number, field: keyof PricingLineItem, val: any) => {
        const next = [...pricingItems];
        const current = { ...next[index], [field]: val };
        if (field === "quantity" || field === "unitPrice") {
            const qty = field === "quantity" ? Number(val) || 0 : Number(current.quantity) || 0;
            const price = field === "unitPrice" ? Number(val) || 0 : Number(current.unitPrice) || 0;
            current.total = qty * price;
        }
        next[index] = current;
        setPricingItems(next);
    };

    // Apply template
    const applyTemplate = (tpl: (typeof TEMPLATES)[0]) => {
        setScope(tpl.scope);
        setTechnicalApproach(tpl.technicalApproach);
        setTimeline(tpl.timeline);
        setDeliverables(tpl.deliverables);
        setPricingItems(tpl.pricingItems);
        setTerms(tpl.terms);
        toast.success(`Template "${tpl.name}" applied!`);
    };

    // Save handler
    const handleSave = async (statusOverride?: "Draft" | "Sent") => {
        const isSentAction = statusOverride === "Sent";
        if (isSentAction) setIsPublishing(true);
        else setIsSaving(true);

        const cleanDeliverables = deliverables
            .map((d) => (typeof d === "string" ? d : typeof d === "object" && d !== null ? ((d as any).title || (d as any).description || "") : String(d || "")).trim())
            .filter(Boolean);
        const cleanPricing = pricingItems.filter((p) => (p?.name || "").trim() !== "");

        const payload: ProposalData = {
            proposalCode,
            scope,
            technicalApproach,
            deliverables: cleanDeliverables,
            timeline,
            pricingStructure: cleanPricing,
            subtotal,
            discount,
            tax,
            total: grandTotal,
            terms,
            validUntil: validUntil ? new Date(validUntil) : null,
            contractSettings,
        };

        try {
            const res = await updateProposal(proposal.id, payload, statusOverride);
            if (res.success) {
                setLastSavedAt(new Date());
                if (statusOverride) {
                    setCurrentStatus(statusOverride);
                }
                if (isSentAction) {
                    toast.success("Proposal published and marked as Sent!");
                    setIsPublishModalOpen(true);
                } else {
                    toast.success("Proposal draft saved successfully.");
                }
                router.refresh();
            } else {
                toast.error(res.message || "Failed to save proposal");
            }
        } catch (e) {
            console.error(e);
            toast.error("System error while saving proposal");
        } finally {
            setIsSaving(false);
            setIsPublishing(false);
        }
    };

    const handleSendEmail = async () => {
        setIsSendingEmail(true);
        try {
            const res = await sendProposalEmail(proposal.id);
            if (res.success) {
                toast.success(`Proposal notification email dispatched to ${proposal.lead?.client?.email || "client"}!`);
            } else {
                toast.error(res.message || "Failed to dispatch email");
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to send proposal email");
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(clientUrl);
        setCopiedLink(true);
        toast.success("Direct proposal link copied to clipboard!");
        setTimeout(() => setCopiedLink(false), 2500);
    };

    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

    const handleDownloadPdf = async () => {
        try {
            setIsDownloadingPdf(true);
            toast.info("Generating executive Statement of Work PDF...");
            const res = await fetch(`/api/proposals/${proposal.id}/pdf`);
            if (!res.ok) {
                window.print();
                return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Statement_of_Work_${proposalCode || proposal.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success("Statement of Work PDF downloaded!");
        } catch (e) {
            console.error("PDF download error:", e);
            window.print();
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    // Live preview document data
    const previewData: ProposalDocumentData = {
        proposalCode,
        businessName,
        clientEmail: proposal.lead?.client?.email,
        scope,
        technicalApproach,
        deliverables: deliverables
            .map((d) => (typeof d === "string" ? d : typeof d === "object" && d !== null ? ((d as any).title || (d as any).description || "") : String(d || "")).trim())
            .filter(Boolean),
        timeline,
        pricingStructure: pricingItems.filter((p) => (p?.name || "").trim() !== ""),
        subtotal,
        discount,
        tax,
        total: grandTotal,
        terms,
        validUntil,
        status: currentStatus,
        acceptedByName: proposal.acceptedByName,
        acceptedByTitle: proposal.acceptedByTitle,
        acceptedAt: proposal.acceptedAt,
        signatureData: proposal.signatureData,
        createdAt: proposal.createdAt,
        contractSettings,
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            {/* Top Navigation / Action Bar */}
            <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 lg:px-8 py-3.5 flex items-center justify-between no-print">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/leads`)}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Lead
                    </Button>
                    <div className="h-4 w-px bg-border hidden sm:block" />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-base tracking-tight">Proposal Studio</span>
                            <Badge
                                variant={
                                    currentStatus === "Approved"
                                        ? "default"
                                        : currentStatus === "Sent"
                                        ? "secondary"
                                        : "outline"
                                }
                                className={`text-xs capitalize font-medium ${
                                    currentStatus === "Sent" 
                                        ? "border-sky-500/40 text-sky-400 bg-sky-500/10" 
                                        : currentStatus === "Approved"
                                        ? "bg-primary text-black font-semibold"
                                        : ""
                                }`}
                            >
                                {currentStatus === "Sent" ? "Sent to Client" : currentStatus === "Approved" ? "Executed Contract" : currentStatus}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 hidden sm:flex">
                            <span className="text-foreground font-medium">{businessName}</span>
                            <span>•</span>
                            <span className="font-mono text-[11px]">{proposalCode}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-mono text-[11px]">
                                <span className={`h-1.5 w-1.5 rounded-full ${isSaving || isPublishing ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`} />
                                <span className={isSaving || isPublishing ? "text-amber-400" : "text-muted-foreground"}>
                                    {isSaving ? "Saving changes..." : isPublishing ? "Publishing..." : lastSavedAt ? `Saved at ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Draft"}
                                </span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {/* Template Preset Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="hidden md:flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                                Templates
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                            <DropdownMenuLabel>Load Preset Template</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {TEMPLATES.map((tpl, i) => (
                                <DropdownMenuItem key={i} onClick={() => applyTemplate(tpl)} className="cursor-pointer">
                                    <div>
                                        <div className="font-medium text-xs">{tpl.name}</div>
                                        <div className="text-[10px] text-muted-foreground line-clamp-1">{tpl.timeline}</div>
                                    </div>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Print / PDF Trigger */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadPdf}
                        disabled={isDownloadingPdf}
                        className="items-center gap-1.5"
                        title="Download Statement of Work PDF"
                    >
                        {isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                        <span className="hidden sm:inline">Export SOW PDF</span>
                    </Button>

                    {/* Share Client Link Trigger */}
                    {currentStatus !== "Draft" && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsPublishModalOpen(true)}
                            className="items-center gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                            title="Share proposal with client"
                        >
                            <Share2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Share Link</span>
                        </Button>
                    )}

                    {/* Save Draft */}
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={isSaving || isPublishing}
                        onClick={() => handleSave("Draft")}
                        className="items-center gap-1.5"
                    >
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Draft
                    </Button>

                    {/* Publish / Mark Sent */}
                    <Button
                        size="sm"
                        disabled={isSaving || isPublishing}
                        onClick={() => handleSave("Sent")}
                        className="bg-primary text-black font-semibold hover:bg-primary/90 items-center gap-1.5 shadow-sm"
                    >
                        {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        {currentStatus === "Sent" ? "Update & Re-send" : "Publish & Send"}
                    </Button>
                </div>
            </header>

            {/* Split Screen Workspace */}
            <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0">
                {/* Left Panel: Form & Line Items (50% / 6 cols on lg) */}
                <div className="lg:col-span-6 border-r border-border p-6 lg:p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-61px)] no-print override-scrollbar">
                    {/* Section: Metadata */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
                            <FileText className="h-4 w-4 text-primary" /> General Info & Validity
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5 sm:col-span-1">
                                <Label htmlFor="proposalCode" className="text-xs">Proposal Ref</Label>
                                <Input
                                    id="proposalCode"
                                    value={proposalCode}
                                    onChange={(e) => setProposalCode(e.target.value)}
                                    placeholder="OPT-2026-0001"
                                    className="font-mono text-xs"
                                />
                            </div>
                            <div className="space-y-1.5 sm:col-span-1">
                                <Label htmlFor="businessName" className="text-xs">Client Business Name</Label>
                                <Input
                                    id="businessName"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    placeholder="Company / Client"
                                />
                            </div>
                            <div className="space-y-1.5 sm:col-span-1">
                                <Label htmlFor="validUntil" className="text-xs">Valid Until Date</Label>
                                <Input
                                    id="validUntil"
                                    type="date"
                                    value={validUntil}
                                    onChange={(e) => setValidUntil(e.target.value)}
                                    className="text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section: Scope & Objectives */}
                    <div className="space-y-4 pt-4 border-t border-border/60">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
                            <Layers className="h-4 w-4 text-primary" /> Scope of Work & Strategy
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="scope" className="text-xs">Project Scope & Objectives</Label>
                                <Textarea
                                    id="scope"
                                    rows={4}
                                    value={scope}
                                    onChange={(e) => setScope(e.target.value)}
                                    placeholder="Detail what problem this project solves and the core solution architecture..."
                                    className="leading-relaxed text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="technicalApproach" className="text-xs">Technical Approach & Stack (Optional)</Label>
                                <Textarea
                                    id="technicalApproach"
                                    rows={3}
                                    value={technicalApproach}
                                    onChange={(e) => setTechnicalApproach(e.target.value)}
                                    placeholder="Outline the tech stack, security standards, and deployment pipelines..."
                                    className="leading-relaxed text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section: Deliverables */}
                    <div className="space-y-4 pt-4 border-t border-border/60">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
                                <CheckCircle2 className="h-4 w-4 text-primary" /> Deliverables Matrix
                            </div>
                            <Button variant="outline" size="sm" onClick={addDeliverable} className="h-7 text-xs">
                                <Plus className="h-3 w-3 mr-1" /> Add Deliverable
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {deliverables.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-muted-foreground w-6 text-center">{idx + 1}.</span>
                                    <Input
                                        value={item}
                                        onChange={(e) => updateDeliverable(idx, e.target.value)}
                                        placeholder={`Deliverable ${idx + 1} item...`}
                                        className="text-sm"
                                    />
                                    {deliverables.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeDeliverable(idx)}
                                            className="text-muted-foreground hover:text-destructive shrink-0 h-9 w-9"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section: Timeline */}
                    <div className="space-y-4 pt-4 border-t border-border/60">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
                            <Calendar className="h-4 w-4 text-primary" /> Estimated Timeline
                        </div>
                        <Input
                            value={timeline}
                            onChange={(e) => setTimeline(e.target.value)}
                            placeholder="e.g. 4 - 6 Weeks (Milestone-based delivery)"
                            className="text-sm"
                        />
                    </div>

                    {/* Section: Pricing & Investment Schedule */}
                    <div className="space-y-4 pt-4 border-t border-border/60">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
                                <DollarSign className="h-4 w-4 text-primary" /> Investment Schedule
                            </div>
                            <Button variant="outline" size="sm" onClick={addPricingItem} className="h-7 text-xs">
                                <Plus className="h-3 w-3 mr-1" /> Add Line Item
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {pricingItems.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="p-3.5 rounded-lg bg-muted/40 border border-border/80 space-y-2.5 relative"
                                >
                                    <div className="flex items-start gap-2">
                                        <div className="flex-1 space-y-1">
                                            <Input
                                                value={item.name}
                                                onChange={(e) => updatePricingItem(idx, "name", e.target.value)}
                                                placeholder="Service / Phase Name (e.g. Frontend Architecture)"
                                                className="font-medium text-sm"
                                            />
                                            <Input
                                                value={item.description || ""}
                                                onChange={(e) => updatePricingItem(idx, "description", e.target.value)}
                                                placeholder="Description or sub-scope (optional)"
                                                className="text-xs text-muted-foreground"
                                            />
                                        </div>
                                        {pricingItems.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removePricingItem(idx)}
                                                className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 pt-1">
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground uppercase">Qty</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) =>
                                                    updatePricingItem(idx, "quantity", parseInt(e.target.value) || 1)
                                                }
                                                className="h-8 text-xs font-mono"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground uppercase">Unit Rate ($)</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={item.unitPrice}
                                                onChange={(e) =>
                                                    updatePricingItem(idx, "unitPrice", parseFloat(e.target.value) || 0)
                                                }
                                                className="h-8 text-xs font-mono"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground uppercase">Item Total</Label>
                                            <div className="h-8 flex items-center justify-end font-mono text-sm font-semibold px-2 bg-background/50 rounded border border-border">
                                                ${item.total.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Financial Aggregate Summary Controls */}
                        <div className="p-4 rounded-lg bg-muted/60 border border-border space-y-3 font-mono text-xs">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Subtotal:</span>
                                <span className="font-semibold text-foreground">${subtotal.toLocaleString()}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="discount" className="text-xs text-muted-foreground">Discount ($):</Label>
                                    <Input
                                        id="discount"
                                        type="number"
                                        min="0"
                                        value={discount}
                                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                        className="h-7 text-xs font-mono"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="tax" className="text-xs text-muted-foreground">Tax ($):</Label>
                                    <Input
                                        id="tax"
                                        type="number"
                                        min="0"
                                        value={tax}
                                        onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                                        className="h-7 text-xs font-mono"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-border/80 font-sans font-bold text-base">
                                <span className="font-serif">Grand Total:</span>
                                <span className="text-primary font-mono text-lg">${grandTotal.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Section: Contract Settings (Collapsible) */}
                    <div className="space-y-3 pt-4 border-t border-border/60">
                        <button
                            type="button"
                            onClick={() => setShowContractSettings((v) => !v)}
                            className="flex items-center justify-between w-full text-sm font-semibold text-foreground uppercase tracking-wider font-mono hover:text-primary transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                Contract Settings
                                <span className="text-[10px] font-normal text-muted-foreground normal-case tracking-normal">(optional — fill in later)</span>
                            </span>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showContractSettings ? "rotate-180" : ""}`} />
                        </button>

                        {showContractSettings && (
                            <div className="space-y-5 p-4 rounded-xl bg-muted/30 border border-border/60">
                                {/* Client Details */}
                                <div className="space-y-3">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-semibold border-b border-border/40 pb-1">Client Details</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Client Contact Person</Label>
                                            <Input placeholder="e.g. Juan dela Cruz" value={contractSettings.clientContactPerson || ""} onChange={(e) => updateCS("clientContactPerson", e.target.value)} className="text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Client Phone</Label>
                                            <Input placeholder="e.g. +63 917 123 4567" value={contractSettings.clientPhone || ""} onChange={(e) => updateCS("clientPhone", e.target.value)} className="text-xs" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Client Address <span className="text-muted-foreground font-normal">(leave blank if not yet available)</span></Label>
                                        <Input placeholder="e.g. 123 Business St., Makati City — or leave blank" value={contractSettings.clientAddress || ""} onChange={(e) => updateCS("clientAddress", e.target.value)} className="text-xs" />
                                    </div>
                                </div>

                                {/* Agency Details */}
                                <div className="space-y-3">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-semibold border-b border-border/40 pb-1">Agency Details</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Agency Phone</Label>
                                            <Input placeholder="e.g. +63 917 000 0000" value={contractSettings.agencyPhone || ""} onChange={(e) => updateCS("agencyPhone", e.target.value)} className="text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Company Reg. / SEC No.</Label>
                                            <Input placeholder="e.g. CS202500001" value={contractSettings.agencyRegistration || ""} onChange={(e) => updateCS("agencyRegistration", e.target.value)} className="text-xs" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Agency Address</Label>
                                        <Input placeholder="e.g. BGC, Taguig City, Metro Manila" value={contractSettings.agencyAddress || ""} onChange={(e) => updateCS("agencyAddress", e.target.value)} className="text-xs" />
                                    </div>
                                </div>

                                {/* Commercial */}
                                <div className="space-y-3">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-semibold border-b border-border/40 pb-1">Commercial</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Governing Law / Jurisdiction</Label>
                                            <Input placeholder="e.g. Republic of the Philippines" value={contractSettings.governingLaw || ""} onChange={(e) => updateCS("governingLaw", e.target.value)} className="text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Accepted Payment Method</Label>
                                            <Input placeholder="e.g. Bank Transfer, GCash, PayPal" value={contractSettings.paymentMethod || ""} onChange={(e) => updateCS("paymentMethod", e.target.value)} className="text-xs" />
                                        </div>
                                    </div>
                                </div>

                                {/* Client Requirements on Acceptance */}
                                <div className="space-y-2">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-semibold border-b border-border/40 pb-1">Client Requirements on Acceptance</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {([
                                            { key: "requireClientAddressOnAccept", label: "Require Registered Address" },
                                            { key: "requireClientPhoneOnAccept", label: "Require Phone Number" },
                                            { key: "requireClientTaxIdOnAccept", label: "Require Tax ID / Reg No." },
                                        ] as { key: keyof ContractSettings; label: string }[]).map(({ key, label }) => (
                                            <label key={key} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 hover:bg-muted/50 cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={!!contractSettings[key]}
                                                    onChange={(e) => updateCS(key, e.target.checked)}
                                                    className="accent-primary h-3.5 w-3.5"
                                                />
                                                <span className="text-xs text-foreground">{label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground pt-1">
                                        Check these if the client still hasn&apos;t provided this information. They will be required to fill it out in the Studio when they accept and sign the proposal.
                                    </p>
                                </div>

                                {/* Legal Clause Toggles */}
                                <div className="space-y-2">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-semibold border-b border-border/40 pb-1">Legal Clauses — Include in Document?</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {([
                                            { key: "includeConfidentiality", label: "Confidentiality / NDA" },
                                            { key: "includeIpClause", label: "Intellectual Property" },
                                            { key: "includeLiabilityClause", label: "Limitation of Liability" },
                                            { key: "includeForceClause", label: "Force Majeure" },
                                            { key: "includeChangeOrder", label: "Change Order Process" },
                                            { key: "includeDisputeResolution", label: "Dispute Resolution" },
                                        ] as { key: keyof ContractSettings; label: string }[]).map(({ key, label }) => (
                                            <label key={key} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 hover:bg-muted/50 cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={!!contractSettings[key]}
                                                    onChange={(e) => updateCS(key, e.target.checked)}
                                                    className="accent-primary h-3.5 w-3.5"
                                                />
                                                <span className="text-xs text-foreground">{label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom Clauses */}
                                <div className="space-y-1">
                                    <Label className="text-xs">Additional / Custom Clauses <span className="text-muted-foreground font-normal">(optional free text)</span></Label>
                                    <Textarea
                                        rows={3}
                                        placeholder="Any other agreed terms, special conditions, or additional clauses..."
                                        value={contractSettings.customClauses || ""}
                                        onChange={(e) => updateCS("customClauses", e.target.value)}
                                        className="text-xs leading-relaxed"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section: Terms & Conditions */}
                    <div className="space-y-4 pt-4 border-t border-border/60">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
                            <FileText className="h-4 w-4 text-primary" /> Agency Terms &amp; Milestones
                        </div>
                        <Textarea
                            rows={3}
                            value={terms}
                            onChange={(e) => setTerms(e.target.value)}
                            placeholder="Specify deposit requirements, payment milestones, and warranty period..."
                            className="leading-relaxed text-xs"
                        />
                    </div>
                </div>

                {/* Right Panel: Live Document Canvas Preview (50% / 6 cols on lg) */}
                <div className="lg:col-span-6 bg-muted/20 p-4 lg:p-10 flex flex-col items-center justify-start overflow-y-auto max-h-[calc(100vh-61px)] override-scrollbar">
                    <div className="w-full max-w-[850px] mb-4 flex items-center justify-between text-xs text-muted-foreground no-print">
                        <div className="flex items-center gap-1.5 font-mono">
                            <Eye className="w-3.5 h-3.5 text-primary" /> Live Document Canvas Preview
                        </div>
                        <span className="font-mono text-[11px]">Real-time Sync Active</span>
                    </div>

                    {/* Render The Shared Pure Presentational Sheet */}
                    <ProposalDocumentSheet data={previewData} />
                </div>
            </main>

            {/* Publish & Share Success Modal */}
            <Dialog open={isPublishModalOpen} onOpenChange={setIsPublishModalOpen}>
                <DialogContent className="sm:max-w-lg bg-card border-border text-foreground">
                    <DialogHeader className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold">Proposal Published &amp; Sent!</DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">
                                    This Statement of Work is now active and ready for client execution.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* How client accesses it */}
                        <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2 text-xs">
                            <div className="font-semibold text-foreground flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-primary" />
                                How Your Client Can Access This Proposal:
                            </div>
                            <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
                                <li>
                                    <strong className="text-foreground">In Client Portal:</strong> The client can log in to their portal (<span className="text-primary font-mono">/portal</span> &amp; <span className="text-primary font-mono">/portal/services</span>) where this proposal is prominently featured for review &amp; digital signature.
                                </li>
                                <li>
                                    <strong className="text-foreground">Direct Secure URL:</strong> Send them the direct link below via email, Slack, or WhatsApp.
                                </li>
                            </ul>
                        </div>

                        {/* Direct Link Box */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Direct Shareable Link</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    readOnly
                                    value={clientUrl}
                                    className="font-mono text-xs bg-background border-border text-foreground"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyLink}
                                    className="shrink-0 gap-1.5"
                                >
                                    {copiedLink ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                                    <span>{copiedLink ? "Copied" : "Copy"}</span>
                                </Button>
                            </div>
                        </div>

                        {/* Email Dispatch Option */}
                        {proposal.lead?.client?.email && (
                            <div className="p-3 rounded-xl border border-border bg-card flex items-center justify-between gap-3">
                                <div className="space-y-0.5">
                                    <span className="text-xs font-semibold text-foreground block">Email Client Notification</span>
                                    <span className="text-[11px] text-muted-foreground block font-mono">
                                        Send invitation to {proposal.lead.client.email}
                                    </span>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={isSendingEmail}
                                    onClick={handleSendEmail}
                                    className="shrink-0 gap-1.5 text-xs"
                                >
                                    {isSendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 text-primary" />}
                                    <span>Send Email</span>
                                </Button>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex flex-col sm:flex-row gap-2 border-t border-border pt-4">
                        <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="w-full sm:w-auto"
                        >
                            <a href={`/proposal/${proposal.id}`} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-3.5 w-3.5 mr-1.5" /> View as Client
                            </a>
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push("/dashboard/proposals")}
                            className="w-full sm:w-auto"
                        >
                            Back to Proposals
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => setIsPublishModalOpen(false)}
                            className="bg-primary text-black font-semibold hover:bg-primary/90 w-full sm:w-auto"
                        >
                            Continue Editing
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
