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
    Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { updateProposal, sendProposalEmail, ProposalData, ContractSettings, resetProposalNeedsGoals, updateProposalMilestones, savePaymentSchedule, sendProposal } from "@/features/proposals/actions";
import { CountryPhoneInput } from "@/components/ui/country-phone-input";
import { printProposalPdf } from "@/features/proposals/utils/printProposalPdf";
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


const DEFAULT_PROPOSAL_MILESTONES = [
    { key: "requirements", title: "Requirements & Architecture", description: "Confirm features, user stories, acceptance criteria" },
    { key: "design", title: "UI/UX Design & Prototyping", description: "Wireframes and screen designs for approval" },
    { key: "development", title: "Full-Stack Development", description: "Built in two-week sprints with a demo after each" },
    { key: "uat_testing", title: "QA & UAT Testing", description: "Client tests on the agreed date; fixes before release" },
    { key: "handover", title: "Final Handover & Deployment", description: "Deployment, training, source code, documentation" },
] as const;

const DEFAULT_PAYMENT_SCHEDULE_ITEMS = [
    { label: "On signing", percent: 30, trigger: "on_signing", sortOrder: 0 },
    { label: "After design approval", percent: 30, trigger: "design", sortOrder: 1 },
    { label: "On handover", percent: 40, trigger: "handover", sortOrder: 2 },
] as const;

interface ProposalBuilderStudioProps {
    proposal: {
        id: string;
        leadId: string;
        proposalCode?: string | null;
        scope?: string | null;
        deliverables?: unknown;
        timeline?: string | null;
        technicalApproach?: string | null;
        pricingStructure?: unknown;
        subtotal?: number | null;
        priceMode?: "to_be_discussed" | "priced" | null;
        currency?: "PHP" | "USD" | null;
        totalPrice?: number | null;
        needsGoals?: string | { needs?: string; goals?: string } | null;
        milestones?: Array<{
            key: string;
            title: string;
            startDate?: string | null;
            endDate?: string | null;
        }> | null;
        paymentScheduleItems?: Array<{
            id?: string;
            label: string;
            percent: number;
            trigger: string;
            sortOrder?: number;
        }> | null;
        discount?: number | null;
        tax?: number | null;
        total?: number | null;
        terms?: string | null;
        validUntil?: Date | string | null;
        status: "draft" | "sent" | "pricing_meeting_requested" | "changes_requested" | "signed" | "declined" | "replaced";
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
    settings?: {
        logoUrl?: string | null;
        logoDarkUrl?: string | null;
        faviconUrl?: string | null;
        heroTitle?: string | null;
    } | null;
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

export function ProposalBuilderStudio({ proposal, settings }: ProposalBuilderStudioProps) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [currentStatus, setCurrentStatus] = useState<string>(proposal.status);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() => {
        if (!proposal.createdAt) return null;
        const d = new Date(proposal.createdAt);
        return isNaN(d.getTime()) ? null : d;
    });
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    // Sync URL in address bar to canonical proposal ID without full navigation reload
    React.useEffect(() => {
        if (typeof window !== "undefined" && proposal?.id) {
            const canonicalPath = `/dashboard/proposals/builder/${proposal.id}`;
            if (window.location.pathname !== canonicalPath) {
                window.history.replaceState(null, "", canonicalPath);
            }
        }
    }, [proposal?.id]);

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
                return [String(raw)];
            }
        }
        if (Array.isArray(raw)) {
            const list: string[] = raw.map((d: unknown) => {
                if (typeof d === "string") return d;
                if (d && typeof d === "object") {
                    const item = d as { title?: string; description?: string };
                    return item.title ? (item.description ? `${item.title}: ${item.description}` : item.title) : (item.description || JSON.stringify(d));
                }
                return String(d || "");
            }).filter((s) => typeof s === "string" && s.trim() !== "");
            return list.length > 0 ? (list as string[]) : [""];
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
        if (typeof raw === "object" && raw !== null && "items" in raw && Array.isArray((raw as { items?: unknown[] }).items)) {
            raw = (raw as { items: unknown[] }).items;
        }
        if (Array.isArray(raw)) {
            const list = raw.map((i: unknown) => {
                const item = (i && typeof i === "object" ? i : {}) as Record<string, unknown>;
                const name = String(item.name || item.title || item.description || "Service Item");
                const description = String(item.description || "");
                const quantity = Number(item.quantity) || 1;
                const unitPrice = Number(item.unitPrice ?? item.amount ?? item.price) || 0;
                const total = Number(item.total) || quantity * unitPrice;
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
    const initialNeedsGoals = typeof proposal.needsGoals === "object" && proposal.needsGoals !== null
        ? [proposal.needsGoals.needs ? `Client Needs:\n${proposal.needsGoals.needs}` : "", proposal.needsGoals.goals ? `Goals:\n${proposal.needsGoals.goals}` : ""].filter(Boolean).join("\n\n")
        : (typeof proposal.needsGoals === "string" ? proposal.needsGoals : (proposal.scope || ""));
    const [needsGoals, setNeedsGoals] = useState(initialNeedsGoals);
    const [isNeedsGoalsModalOpen, setIsNeedsGoalsModalOpen] = useState(false);
    const [isResettingNeedsGoals, setIsResettingNeedsGoals] = useState(false);

    const [milestones, setMilestones] = useState<Array<{
        key: string;
        title: string;
        description: string;
        startDate: string;
        endDate: string;
    }>>(() => {
        const list = (proposal as { milestones?: Array<{ name?: string; key?: string; startDate?: string | null | Date; endDate?: string | null | Date }> }).milestones || [];
        const map = new Map(list.map((m) => [m.name || m.key, m]));
        return DEFAULT_PROPOSAL_MILESTONES.map((def) => {
            const found = map.get(def.key);
            return {
                key: def.key,
                title: def.title,
                description: def.description,
                startDate: (found?.startDate as string) || "",
                endDate: (found?.endDate as string) || "",
            };
        });
    });
    const [isMilestonesModalOpen, setIsMilestonesModalOpen] = useState(false);
    const [isScopeTimelineModalOpen, setIsScopeTimelineModalOpen] = useState(false);
    const [isSavingMilestones, setIsSavingMilestones] = useState(false);

    const [paymentSchedule, setPaymentSchedule] = useState<Array<{
        id?: string;
        label: string;
        percent: number;
        trigger: string;
        sortOrder?: number;
    }>>(() => {
        const list = (proposal as { paymentScheduleItems?: Array<{ id?: string; label: string; percent: number; trigger: string; sortOrder?: number }> }).paymentScheduleItems || [];
        if (list.length > 0) {
            return list.map((item) => ({
                id: item.id,
                label: item.label,
                percent: Number(item.percent) || 0,
                trigger: item.trigger || "on_signing",
                sortOrder: item.sortOrder ?? 0,
            }));
        }
        return DEFAULT_PAYMENT_SCHEDULE_ITEMS.map((item, idx) => ({
            label: item.label,
            percent: item.percent,
            trigger: item.trigger,
            sortOrder: idx,
        }));
    });
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);

    const totalSchedulePercent = useMemo(() => {
        return paymentSchedule.reduce((sum, item) => sum + (Number(item.percent) || 0), 0);
    }, [paymentSchedule]);

    const scheduleSummaryText = useMemo(() => {
        if (paymentSchedule.length === 0) return "No payments configured";
        const parts = paymentSchedule.map(p => `${p.percent}% ${p.label.toLowerCase()}`);
        return `${paymentSchedule.length} payments · ${parts.join(", ")}`;
    }, [paymentSchedule]);

    const handleSaveSchedule = async () => {
        if (totalSchedulePercent !== 100) {
            toast.error(`Percents must add up to exactly 100% (currently ${totalSchedulePercent}%).`);
            return;
        }
        for (const item of paymentSchedule) {
            if (!item.label.trim()) {
                toast.error("Every payment schedule item must have a label.");
                return;
            }
        }
        setIsSavingSchedule(true);
        try {
            const res = await savePaymentSchedule(proposal.id, paymentSchedule);
            if (res.success) {
                toast.success("Payment schedule saved!");
                setIsScheduleModalOpen(false);
            } else {
                toast.error(res.message || "Failed to save payment schedule");
            }
        } catch {
            toast.error("Failed to save payment schedule");
        } finally {
            setIsSavingSchedule(false);
        }
    };


    const milestoneDateRangeText = useMemo(() => {
        const dates = milestones.flatMap(m => [m.startDate, m.endDate]).filter(Boolean).sort();
        if (dates.length === 0) return "5 default milestones · Dates not set";
        const start = new Date(dates[0]).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const end = new Date(dates[dates.length - 1]).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return `5 default milestones · ${start} – ${end}`;
    }, [milestones]);

    const handleSaveMilestones = async () => {
        setIsSavingMilestones(true);
        try {
            const res = await updateProposalMilestones(proposal.id, milestones);
            if (totalSchedulePercent === 100) {
                await savePaymentSchedule(proposal.id, paymentSchedule);
            } else if (priceMode === "priced") {
                toast.error(`Payment schedule total is ${totalSchedulePercent}%. It must be exactly 100%.`);
                return;
            }
            if (res.success) {
                toast.success("Milestone dates updated!");
                setIsMilestonesModalOpen(false);
            } else {
                toast.error(res.message || "Failed to update milestone dates");
            }
        } catch {
            toast.error("Error updating milestone dates");
        } finally {
            setIsSavingMilestones(false);
        }
    };


    const handleResetNeedsGoals = async () => {
        setIsResettingNeedsGoals(true);
        try {
            const res = await resetProposalNeedsGoals(proposal.id);
            if (res.success && (res as any).needsGoals) {
                const ng = (res as any).needsGoals;
                const formatted = typeof ng === "object" && ng !== null
                    ? [ng.needs ? `Client Needs:\n${ng.needs}` : "", ng.goals ? `Goals:\n${ng.goals}` : ""].filter(Boolean).join("\n\n")
                    : String(ng || "");
                setNeedsGoals(formatted);
                toast.success("Needs and goals reset to discovery form values.");
            } else {
                toast.error(res.message || "Failed to reset");
            }
        } catch {
            toast.error("Failed to reset needs and goals");
        } finally {
            setIsResettingNeedsGoals(false);
        }
    };
    const [priceMode, setPriceMode] = useState<"to_be_discussed" | "priced">(
        proposal.priceMode || "to_be_discussed"
    );
    const [currency, setCurrency] = useState<"PHP" | "USD">(
        proposal.currency || "PHP"
    );
    const [totalPrice, setTotalPrice] = useState<number | null>(
        proposal.totalPrice !== undefined && proposal.totalPrice !== null
            ? Number(proposal.totalPrice)
            : null
    );
    const [discount, setDiscount] = useState<number>(Number(proposal.discount) || 0);
    const [tax, setTax] = useState<number>(Number(proposal.tax) || 0);
    const [terms, setTerms] = useState(
        proposal.terms ||
            "Standard agency terms apply: 50% deposit required upon acceptance to initiate sprint planning, with the remaining balance due upon milestone handover."
    );
    const [validUntil, setValidUntil] = useState<string>(() => {
        try {
            if (proposal.validUntil) {
                const d = new Date(proposal.validUntil);
                if (!isNaN(d.getTime())) {
                    return d.toISOString().split("T")[0];
                }
            }
        } catch {}
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    });
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
    const handleSave = async (statusOverride?: string) => {
        const isSentAction = statusOverride === "sent";
        if (isSentAction) setIsPublishing(true);
        else setIsSaving(true);

        const cleanDeliverables = deliverables
            .map((d: unknown) => (typeof d === "string" ? d : typeof d === "object" && d !== null ? (((d as { title?: string; description?: string }).title) || ((d as { title?: string; description?: string }).description) || "") : String(d || "")).trim())
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
            priceMode,
            currency,
            totalPrice: priceMode === "priced" ? (totalPrice !== null ? Number(totalPrice) : null) : null,
            needsGoals,
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
                const errText = await res.text().catch(() => "");
                console.error("PDF generation endpoint returned non-200:", res.status, errText);
                toast.error(`PDF generation failed (${res.status}). Opening print preview as fallback...`);
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
            toast.error("Could not download PDF. Opening print preview...");
            window.print();
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    const handlePrint = async () => {
        try {
            toast.info("Preparing print-ready Statement of Work...");
            await printProposalPdf(proposal.id);
        } catch (e) {
            console.error("Print PDF error:", e);
            toast.error("Could not prepare PDF. Opening browser print instead...");
            window.print();
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
            .map((d: unknown) => (typeof d === "string" ? d : typeof d === "object" && d !== null ? (((d as { title?: string; description?: string }).title) || ((d as { title?: string; description?: string }).description) || "") : String(d || "")).trim())
            .filter(Boolean),
        timeline,
        pricingStructure: pricingItems.filter((p) => (p?.name || "").trim() !== ""),
        subtotal,
        discount,
        tax,
        total: grandTotal,
        priceMode,
        currency,
        totalPrice: priceMode === "priced" ? (totalPrice !== null ? Number(totalPrice) : null) : null,
        needsGoals,
        milestones: milestones.map(m => ({
            key: m.key,
            title: m.title,
            description: m.description,
            startDate: m.startDate || null,
            endDate: m.endDate || null,
        })),
        paymentScheduleItems: paymentSchedule,
        terms,
        validUntil,
        status: currentStatus,
        acceptedByName: proposal.acceptedByName,
        acceptedByTitle: proposal.acceptedByTitle,
        acceptedAt: proposal.acceptedAt,
        signatureData: proposal.signatureData,
        createdAt: proposal.createdAt,
        contractSettings,
        agencyLogoUrl: settings?.logoUrl || null,
        agencyFaviconUrl: settings?.faviconUrl || null,
    };

    return (
        <div className="-mx-4 sm:-mx-8 -mt-24 md:-mt-8 -mb-8 bg-background text-foreground flex flex-col min-h-screen">
            {/* Top Navigation / Action Bar */}
            <header className="h-[61px] shrink-0 sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 lg:px-8 py-3.5 flex items-center justify-between no-print">
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
                                    currentStatus === "signed"
                                        ? "default"
                                        : currentStatus === "sent"
                                        ? "secondary"
                                        : "outline"
                                }
                                className={`text-xs capitalize font-medium ${
                                    currentStatus === "sent" 
                                        ? "border-sky-500/40 text-sky-400 bg-sky-500/10" 
                                        : currentStatus === "signed"
                                        ? "bg-primary text-black font-semibold"
                                        : ""
                                }`}
                            >
                                {currentStatus === "sent" ? "Sent to Client" : currentStatus === "signed" ? "Executed Contract" : currentStatus}
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
                                    {isSaving ? "Saving changes..." : isPublishing ? "Publishing..." : (lastSavedAt && !isNaN(lastSavedAt.getTime())) ? `Saved at ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Draft"}
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

                    {/* Print / PDF Trigger Group */}
                    <div className="flex items-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadPdf}
                            disabled={isDownloadingPdf}
                            className="items-center gap-1.5 rounded-r-none border-r-0"
                            title="Download official Statement of Work PDF"
                        >
                            {isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            <span className="hidden sm:inline">Export SOW PDF</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrint}
                            className="items-center px-2 rounded-l-none text-muted-foreground hover:text-foreground"
                            title="Open browser print dialog / save as PDF"
                        >
                            <Printer className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Share Client Link Trigger */}
                    {currentStatus !== "draft" && (
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
                        onClick={() => handleSave("draft")}
                        className="items-center gap-1.5"
                    >
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Draft
                    </Button>

                    {/* Publish / Mark Sent */}
                    <Button
                        size="sm"
                        disabled={isSaving || isPublishing}
                        onClick={() => handleSave("sent")}
                        className="bg-primary text-black font-semibold hover:bg-primary/90 items-center gap-1.5 shadow-sm"
                    >
                        {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        {currentStatus === "sent" ? "Update & Re-send" : "Publish & Send"}
                    </Button>
                </div>
            </header>

            {/* Split Screen Workspace */}
            <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 print:block print:w-full print:h-auto print:overflow-visible print:m-0 print:p-0">
                {/* Left Panel: Form & Line Items (50% / 6 cols on lg) */}
                <div className="lg:col-span-6 border-r border-border p-6 lg:p-8 space-y-8 overflow-y-auto lg:h-[calc(100vh-61px)] no-print override-scrollbar">
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
                                    maxLength={30}
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
                                    maxLength={100}
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

                    {/* Section: Needs and Goals (Step 10a) */}
                    <div className="space-y-3 pt-4 border-t border-border/60">
                        <div className="p-4 rounded-xl border border-border bg-card/60 flex items-center justify-between gap-4">
                            <div>
                                <strong className="text-foreground text-sm font-semibold block">Needs and goals</strong>
                                <span className="text-xs text-muted-foreground">Filled in from the discovery form · Editable per proposal</span>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsNeedsGoalsModalOpen(true)}
                                className="font-semibold text-xs"
                            >
                                Review &amp; Edit
                            </Button>
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
                                    maxLength={3000}
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
                                    maxLength={3000}
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
                                        maxLength={180}
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

                    {/* Section: Milestones (Step 10b) */}
                    <div className="bg-card border border-border/70 rounded-xl p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <div className="font-semibold text-sm text-foreground">Milestones</div>
                            <div className="text-xs text-muted-foreground">{milestoneDateRangeText}</div>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsMilestonesModalOpen(true)}
                            className="text-xs font-semibold"
                        >
                            Edit dates
                        </Button>
                    </div>

                    {/* Section: Price & Currency (Step 10b / 17a) */}
                    <div className="space-y-4 pt-4 border-t border-border/60">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
                                <DollarSign className="h-4 w-4 text-primary" /> Price
                            </div>
                        </div>

                        {/* Segmented Toggle: Include price vs Price to be discussed */}
                        <div className="grid grid-cols-2 rounded-lg border border-border p-1 bg-muted/30">
                            <button
                                type="button"
                                onClick={() => setPriceMode("priced")}
                                className={`py-2 px-3 text-xs font-semibold rounded-md transition-all ${
                                    priceMode === "priced"
                                        ? "bg-primary text-black shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Include price
                            </button>
                            <button
                                type="button"
                                onClick={() => setPriceMode("to_be_discussed")}
                                className={`py-2 px-3 text-xs font-semibold rounded-md transition-all ${
                                    priceMode === "to_be_discussed"
                                        ? "bg-primary text-black shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Price to be discussed
                            </button>
                        </div>

                        {priceMode === "priced" ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border border-border/80 bg-muted/20">
                                <div>
                                    <Label className="text-xs text-muted-foreground uppercase font-mono">Currency</Label>
                                    <select
                                        value={currency}
                                        onChange={(e) => setCurrency(e.target.value as "PHP" | "USD")}
                                        className="h-9 w-full mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <option value="PHP">PHP (₱)</option>
                                        <option value="USD">USD ($)</option>
                                    </select>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground uppercase font-mono">Total Price</Label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-3 top-2 text-sm text-muted-foreground font-mono">
                                            {currency === "PHP" ? "₱" : "$"}
                                        </span>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={totalPrice === null ? "" : totalPrice}
                                            placeholder="e.g. 150000"
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setTotalPrice(v === "" ? null : Math.max(0, Math.round(Number(v))));
                                            }}
                                            className="pl-8 font-mono text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3.5 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground leading-relaxed">
                                <strong className="text-foreground font-medium block mb-0.5">Price to be discussed</strong>
                                Local client default: SOW specifies technical scope &amp; deliverables first. Investment and payment schedule will be agreed upon during commercial discussion.
                            </div>
                        )}
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
                                            <Input placeholder="e.g. Juan dela Cruz" maxLength={100} value={contractSettings.clientContactPerson || ""} onChange={(e) => updateCS("clientContactPerson", e.target.value)} className="text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Client Phone Number</Label>
                                            <CountryPhoneInput
                                                value={contractSettings.clientPhone || ""}
                                                onChange={(val) => updateCS("clientPhone", val)}
                                                placeholder="(917) 123-4567"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Client Address <span className="text-muted-foreground font-normal">(leave blank if not yet available)</span></Label>
                                        <Input placeholder="e.g. 123 Business St., Makati City — or leave blank" maxLength={250} value={contractSettings.clientAddress || ""} onChange={(e) => updateCS("clientAddress", e.target.value)} className="text-xs" />
                                    </div>
                                </div>

                                {/* Agency Details */}
                                <div className="space-y-3">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-semibold border-b border-border/40 pb-1">Agency Details</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Agency Phone</Label>
                                            <CountryPhoneInput
                                                value={contractSettings.agencyPhone || "+63 (917) 555-1234"}
                                                onChange={(val) => updateCS("agencyPhone", val)}
                                                defaultCountryCode="PH"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Company Reg. / SEC No.</Label>
                                            <Input
                                                placeholder="CS202612345"
                                                maxLength={30}
                                                value={contractSettings.agencyRegistration || "CS202612345"}
                                                onChange={(e) => updateCS("agencyRegistration", e.target.value.toUpperCase().replace(/[^A-Z0-9.-]/g, ""))}
                                                className="text-xs font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Agency Address</Label>
                                        <Input placeholder="e.g. 4th Floor, Innovation Hub Building, Metro Manila, Philippines" maxLength={200} value={contractSettings.agencyAddress || ""} onChange={(e) => updateCS("agencyAddress", e.target.value)} className="text-xs" />
                                    </div>
                                </div>

                                {/* Commercial */}
                                <div className="space-y-3">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-semibold border-b border-border/40 pb-1">Commercial</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Governing Law / Jurisdiction</Label>
                                            <Input placeholder="e.g. Republic of the Philippines" maxLength={100} value={contractSettings.governingLaw || ""} onChange={(e) => updateCS("governingLaw", e.target.value)} className="text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Accepted Payment Method</Label>
                                            <Input placeholder="e.g. Bank Transfer, GCash, PayPal" maxLength={120} value={contractSettings.paymentMethod || ""} onChange={(e) => updateCS("paymentMethod", e.target.value)} className="text-xs" />
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
                                        maxLength={5000}
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
                <div className="lg:col-span-6 bg-muted/20 p-3 sm:p-6 lg:p-8 overflow-y-auto lg:h-[calc(100vh-61px)] w-full min-w-0 override-scrollbar print:p-0 print:m-0 print:h-auto print:overflow-visible print:bg-white print:w-full print:block">
                    <div className="w-full max-w-[850px] mx-auto space-y-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground no-print">
                            <div className="flex items-center gap-1.5 font-mono">
                                <Eye className="w-3.5 h-3.5 text-primary" /> Live Document Canvas Preview
                            </div>
                            <span className="font-mono text-[11px]">Real-time Sync Active</span>
                        </div>

                        {/* Render The Shared Pure Presentational Sheet */}
                        <ProposalDocumentSheet
                            data={previewData}
                            agencyName={settings?.heroTitle ? `${settings.heroTitle} Digital Solutions` : "Optrizo Digital Solutions"}
                            agencyLogoUrl={settings?.logoUrl || null}
                            agencyFaviconUrl={settings?.faviconUrl || null}
                        />
                    </div>
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

            {/* Step 10b: Edit Milestone Dates Dialog */}
            <Dialog open={isMilestonesModalOpen} onOpenChange={setIsMilestonesModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit milestone dates</DialogTitle>
                        <DialogDescription>
                            Only dates are editable. The 5 default milestones and descriptions are fixed across all proposals.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
                        {milestones.map((m, index) => (
                            <div key={m.key} className="p-3.5 border border-border/70 rounded-lg bg-muted/20 space-y-2">
                                <div>
                                    <div className="font-semibold text-sm text-foreground">{m.title}</div>
                                    <div className="text-xs text-muted-foreground">{m.description}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-muted-foreground font-mono">Start date</Label>
                                        <Input
                                            type="date"
                                            value={m.startDate}
                                            onChange={(e) => {
                                                const updated = [...milestones];
                                                updated[index].startDate = e.target.value;
                                                setMilestones(updated);
                                            }}
                                            className="h-8 text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-muted-foreground font-mono">End date</Label>
                                        <Input
                                            type="date"
                                            value={m.endDate}
                                            onChange={(e) => {
                                                const updated = [...milestones];
                                                updated[index].endDate = e.target.value;
                                                setMilestones(updated);
                                            }}
                                            className="h-8 text-xs font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsMilestonesModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleSaveMilestones} disabled={isSavingMilestones}>
                            {isSavingMilestones ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Save dates
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Step 10b: Scope of Work and Timeline View Dialog */}
            <Dialog open={isScopeTimelineModalOpen} onOpenChange={setIsScopeTimelineModalOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Scope of work and timeline</DialogTitle>
                        <DialogDescription>
                            Built automatically from the 5 default milestones. To change dates, close this and use Edit dates on the Milestones card.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground border-b border-border/60 pb-2 mb-2 font-mono uppercase tracking-wider">
                            <span className="col-span-4">Milestone</span>
                            <span className="col-span-5">What is done (standard)</span>
                            <span className="col-span-3 text-right">Dates</span>
                        </div>
                        <div className="divide-y divide-border/40 text-xs">
                            {milestones.map((m) => {
                                const dateStr = m.startDate && m.endDate
                                    ? `${new Date(m.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(m.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                                    : m.startDate
                                    ? `Starts ${new Date(m.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                                    : "Dates to be set";
                                return (
                                    <div key={m.key} className="grid grid-cols-12 gap-2 py-3 items-center">
                                        <b className="col-span-4 font-semibold text-foreground">{m.title}</b>
                                        <span className="col-span-5 text-muted-foreground">{m.description}</span>
                                        <span className="col-span-3 text-right font-mono text-muted-foreground whitespace-nowrap">{dateStr}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-4 pt-2 border-t border-border/40">
                            Read only. Milestone names and descriptions are the same for every project.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsScopeTimelineModalOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Step 17a: Edit Payment Schedule Dialog */}
            <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Payment schedule</DialogTitle>
                        <DialogDescription>
                            Total price {currency === "PHP" ? "₱" : "$"}{totalPrice !== null ? totalPrice.toLocaleString() : "0"}. Set when each payment is due and its share. Amounts are calculated.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
                        <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-muted-foreground uppercase font-mono tracking-wider border-b border-border/60 pb-2">
                            <span className="col-span-5">Payment due</span>
                            <span className="col-span-3">Trigger</span>
                            <span className="col-span-2 text-right">Percent</span>
                            <span className="col-span-2 text-right">Amount</span>
                        </div>
                        {paymentSchedule.map((item, index) => {
                            const calculatedAmount = totalPrice !== null ? Math.round(totalPrice * (item.percent / 100)) : null;
                            return (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center py-1">
                                    <div className="col-span-5">
                                        <Input
                                            value={item.label}
                                            onChange={(e) => {
                                                const updated = [...paymentSchedule];
                                                updated[index].label = e.target.value;
                                                setPaymentSchedule(updated);
                                            }}
                                            placeholder="e.g. On signing"
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <select
                                            value={item.trigger}
                                            onChange={(e) => {
                                                const updated = [...paymentSchedule];
                                                updated[index].trigger = e.target.value;
                                                setPaymentSchedule(updated);
                                            }}
                                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                        >
                                            <option value="on_signing">On signing</option>
                                            <option value="requirements">Requirements</option>
                                            <option value="design">Design approval</option>
                                            <option value="development">Development</option>
                                            <option value="uat_testing">UAT testing</option>
                                            <option value="handover">Handover</option>
                                            <option value="before_completion">Before completion</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={item.percent}
                                                onChange={(e) => {
                                                    const updated = [...paymentSchedule];
                                                    updated[index].percent = Number(e.target.value) || 0;
                                                    setPaymentSchedule(updated);
                                                }}
                                                className="h-8 text-xs text-right pr-6 font-mono"
                                            />
                                            <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
                                        </div>
                                    </div>
                                    <div className="col-span-2 flex items-center justify-between gap-1">
                                        <span className="text-xs font-mono font-medium text-foreground truncate">
                                            {calculatedAmount !== null ? `${currency === "PHP" ? "₱" : "$"}${calculatedAmount.toLocaleString()}` : "—"}
                                        </span>
                                        {paymentSchedule.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = paymentSchedule.filter((_, i) => i !== index);
                                                    setPaymentSchedule(updated);
                                                }}
                                                className="text-destructive hover:opacity-80 text-xs shrink-0"
                                                title="Remove payment"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div className="flex justify-between items-center pt-3 border-t border-border/60">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setPaymentSchedule([
                                        ...paymentSchedule,
                                        { label: "New payment", percent: 0, trigger: "handover", sortOrder: paymentSchedule.length }
                                    ]);
                                }}
                                className="text-xs"
                            >
                                + Add payment
                            </Button>
                            <div className="text-xs font-mono font-bold">
                                <span className={totalSchedulePercent === 100 ? "text-emerald-500" : "text-destructive"}>
                                    Total {totalSchedulePercent}% {totalPrice !== null ? `· ${currency === "PHP" ? "₱" : "$"}${totalPrice.toLocaleString()}` : ""}
                                </span>
                            </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Percents must add up to 100% before you can save.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsScheduleModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveSchedule}
                            disabled={isSavingSchedule || totalSchedulePercent !== 100}
                        >
                            {isSavingSchedule ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Save schedule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
