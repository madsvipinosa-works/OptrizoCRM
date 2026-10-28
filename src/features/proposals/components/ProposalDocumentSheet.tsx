"use client";

import React from "react";
import { CheckCircle2, Calendar, FileText, Building2, ShieldCheck, Briefcase, Phone, MapPin, Scale, CreditCard, Lock, Lightbulb, AlertTriangle, RefreshCw, Gavel, Plus } from "lucide-react";
import type { ContractSettings } from "@/features/proposals/actions";
import { cn } from "@/lib/utils";
import { ProposalDocumentFooter } from "./ProposalDocumentFooter";

export interface PricingLineItem {
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface ProposalDocumentData {
    proposalCode?: string | null;
    businessName?: string | null;
    clientEmail?: string | null;
    scope?: string | null;
    technicalApproach?: string | null;
    deliverables?: string[] | null;
    timeline?: string | null;
    pricingStructure?: PricingLineItem[] | null;
    subtotal?: number | null;
    discount?: number | null;
    tax?: number | null;
    total?: number | null;
    terms?: string | null;
    validUntil?: string | Date | null;
    status?: "Draft" | "Sent" | "Approved" | "Rejected";
    // Signature Audit
    acceptedByName?: string | null;
    acceptedByTitle?: string | null;
    acceptedAt?: string | Date | null;
    signatureData?: string | null;
    createdAt?: string | Date | null;
    // Optional contract settings
    contractSettings?: ContractSettings | null;
    // Agency Branding
    agencyLogoUrl?: string | null;
    agencyFaviconUrl?: string | null;
}

interface ProposalDocumentSheetProps {
    data: ProposalDocumentData;
    agencyName?: string;
    agencyEmail?: string;
    agencyWebsite?: string;
    agencyLogoUrl?: string | null;
    agencyFaviconUrl?: string | null;
}

export function ProposalDocumentSheet({
    data,
    agencyName = "Optrizo Digital Solutions",
    agencyEmail = "contact@optrizo.com",
    agencyWebsite = "https://optrizo.com",
    agencyLogoUrl,
    agencyFaviconUrl,
}: ProposalDocumentSheetProps) {
    const cs = data.contractSettings || {};
    const activeLogoUrl = agencyLogoUrl || data.agencyLogoUrl || null;
    const activeFaviconUrl = agencyFaviconUrl || data.agencyFaviconUrl || null;

    const safeFormatDate = (val: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions, fallback: string = ""): string => {
        if (!val) return fallback;
        try {
            const d = new Date(val);
            if (isNaN(d.getTime())) return fallback;
            return d.toLocaleDateString("en-US", options || { month: "short", day: "numeric", year: "numeric" });
        } catch {
            return fallback;
        }
    };

    const formattedCreatedDate = safeFormatDate(
        data.createdAt,
        { month: "short", day: "numeric", year: "numeric" },
        new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    );

    const formattedValidDate = safeFormatDate(
        data.validUntil,
        { month: "short", day: "numeric", year: "numeric" },
        "30 Days from Issue"
    );

    const deliverablesList = Array.isArray(data.deliverables) ? data.deliverables : [];
    const pricingItems = Array.isArray(data.pricingStructure) ? data.pricingStructure : [];

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });

    // Section counter — increments only for rendered sections
    let sectionNum = 0;
    const nextSection = () => { sectionNum++; return sectionNum; };

    return (
        <div
            id="printable-proposal"
            className="proposal-document-sheet w-full max-w-[850px] min-w-0 mx-auto bg-card text-card-foreground shadow-xl rounded-sm border border-border p-5 sm:p-8 md:p-12 space-y-7 sm:space-y-9 font-sans transition-all overflow-hidden print:p-0 print:border-none print:shadow-none print:max-w-none print:overflow-visible print:bg-white print:text-neutral-900"
        >
            {/* 1. Formal Contract Header (Company Branding & Identifiers) */}
            <header className="proposal-sheet-header border-b-2 border-border/90 pb-6 sm:pb-8 space-y-5 sm:space-y-6 w-full min-w-0 print:block print:w-full print:border-border">
                {/* Letterhead Top Bar: Official Logo, Company Name & Document Tracking */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/50 min-w-0 w-full">
                    <div className="flex items-center gap-3.5 min-w-0 max-w-full">
                        {/* Official Optrizo Emblem or Uploaded Brand Logo */}
                        {activeLogoUrl ? (
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    className="flex items-center shrink-0 overflow-hidden"
                                    style={{ height: 40, maxHeight: 40, maxWidth: 170 }}
                                >
                                    <img
                                        src={activeLogoUrl}
                                        alt={agencyName}
                                        style={{
                                            display: "block",
                                            height: "auto",
                                            width: "auto",
                                            maxHeight: 40,
                                            maxWidth: 170,
                                            objectFit: "contain",
                                            objectPosition: "left center",
                                        }}
                                    />
                                </div>
                                <div className="border-l border-border/70 pl-3 hidden sm:block min-w-0">
                                    <div className="font-mono text-xs font-bold tracking-tight text-foreground uppercase truncate">
                                        {agencyName}
                                    </div>
                                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-mono truncate">
                                        Enterprise Systems &bull; Strategic IT
                                    </div>
                                </div>
                            </div>
                        ) : activeFaviconUrl ? (
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-11 h-11 rounded-xl bg-black/90 dark:bg-black/60 border border-primary/30 flex items-center justify-center shadow-sm shrink-0 overflow-hidden p-1.5">
                                    <img
                                        src={activeFaviconUrl}
                                        alt={agencyName}
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-mono text-sm sm:text-base font-extrabold tracking-tight text-foreground flex items-center gap-1.5 truncate">
                                        <span>OPTRIZO</span>
                                        <span className="text-primary font-bold">DIGITAL SOLUTIONS</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono truncate">
                                        Enterprise Systems &bull; Digital Engineering &bull; Strategic IT
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-11 h-11 rounded-xl bg-black/90 dark:bg-black/60 border border-primary/30 flex items-center justify-center shadow-sm shrink-0">
                                    <svg
                                        width="24"
                                        height="26"
                                        viewBox="0 0 24 26"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="text-[#00D639]"
                                    >
                                        <path
                                            d="M12 1L22 6.77V19.23L12 25L2 19.23V6.77L12 1Z"
                                            stroke="#00D639"
                                            strokeWidth="2.2"
                                            strokeLinejoin="round"
                                        />
                                        <path
                                            d="M7 16V12M12 18V8M17 16V10"
                                            stroke="#00D639"
                                            strokeWidth="2.2"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <div className="font-mono text-sm sm:text-base font-extrabold tracking-tight text-foreground flex items-center gap-1.5 truncate">
                                        <span>OPTRIZO</span>
                                        <span className="text-primary font-bold">DIGITAL SOLUTIONS</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono truncate">
                                        Enterprise Systems &bull; Digital Engineering &bull; Strategic IT
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="text-left sm:text-right font-mono text-xs text-muted-foreground bg-muted/40 border border-border px-3.5 py-2 rounded-md shrink-0 w-full sm:w-auto">
                        <div className="text-[10px] uppercase tracking-wider text-primary font-bold">
                            Official Digital Document
                        </div>
                        <div>
                            REF: <span className="font-bold text-foreground">{data.proposalCode || "OPT-2026-0001"}</span>
                        </div>
                        <div>
                            STATUS: <span className={cn(
                                "font-semibold uppercase text-[10px] px-1.5 py-0.5 rounded",
                                data.status === "Approved" ? "bg-emerald-500/10 text-emerald-500 font-bold" :
                                data.status === "Sent" ? "bg-blue-500/10 text-blue-500 font-bold" :
                                data.status === "Rejected" ? "bg-rose-500/10 text-rose-500 font-bold" :
                                "bg-muted text-muted-foreground"
                            )}>{data.status || "DRAFT"}</span>
                        </div>
                    </div>
                </div>

                {/* Document Title Banner */}
                <div className="space-y-1 w-full min-w-0">
                    <span className="text-[11px] font-mono tracking-widest text-primary font-bold uppercase block">
                        Commercial Engagement Agreement
                    </span>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-foreground tracking-tight break-words">
                        Project Proposal &amp; Statement of Work
                    </h1>
                    {data.businessName && (
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground break-words">
                            Prepared exclusively for: <strong className="text-foreground">{data.businessName}</strong>
                        </p>
                    )}
                </div>

                {/* Parties Summary Box */}
                <div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/20 border border-border/70 text-xs w-full min-w-0 overflow-hidden"
                    style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                >
                    {/* Service Provider */}
                    <div className="space-y-1.5 w-full min-w-0 overflow-hidden" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-primary shrink-0" /> Service Provider / Contractor
                        </span>
                        <div className="font-semibold text-foreground text-sm truncate">{agencyName}</div>
                        <div className="text-muted-foreground break-all">{agencyEmail} • {agencyWebsite}</div>
                        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0 break-words">
                            <Phone className="w-3 h-3 text-emerald-500 shrink-0" /> <span className="break-all">{cs.agencyPhone || "+63 (917) 555-1234"}</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-muted-foreground w-full min-w-0 overflow-hidden">
                            <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                            <span
                                className="min-w-0 flex-1 whitespace-normal leading-relaxed"
                                style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
                            >
                                {cs.agencyAddress || "4th Floor, Innovation Hub Building, Metro Manila, Philippines"}
                            </span>
                        </div>
                        <div className="text-muted-foreground font-mono text-[10px] break-all">
                            Company Reg. / SEC No: <strong className="text-foreground">{cs.agencyRegistration || "CS202612345"}</strong>
                        </div>
                    </div>
                    {/* Client */}
                    <div className="space-y-1.5 w-full min-w-0 overflow-hidden sm:border-l sm:border-border/60 sm:pl-4" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5 text-primary shrink-0" /> Client / Principal
                        </span>
                        <div className="font-semibold text-foreground text-sm break-words truncate">
                            {data.businessName || "Valued Client Organization"}
                        </div>
                        {cs.clientContactPerson && <div className="text-muted-foreground break-words truncate">Attn: {cs.clientContactPerson}</div>}
                        <div className="text-muted-foreground break-all">
                            {data.clientEmail ? `${data.clientEmail} (Authorized Representative)` : "Authorized Signatory"}
                        </div>
                        {cs.clientPhone && (
                            <div className="flex items-center gap-1.5 text-muted-foreground min-w-0 break-words">
                                <Phone className="w-3 h-3 shrink-0" /> <span className="break-all">{cs.clientPhone}</span>
                            </div>
                        )}
                        {cs.clientAddress ? (
                            <div className="flex items-start gap-1.5 text-muted-foreground w-full min-w-0 overflow-hidden">
                                <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                                <span
                                    className="min-w-0 flex-1 whitespace-normal leading-relaxed"
                                    style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
                                >
                                    {cs.clientAddress}
                                </span>
                            </div>
                        ) : (
                            <div className="text-muted-foreground/50 italic text-[10px]">Address: To be furnished upon registration</div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 text-xs font-mono text-muted-foreground pt-1">
                    <div>EFFECTIVE DATE: <span className="text-foreground font-semibold" suppressHydrationWarning>{formattedCreatedDate}</span></div>
                    <div>EXPIRATION DATE: <span className="text-foreground font-semibold" suppressHydrationWarning>{formattedValidDate}</span></div>
                </div>
            </header>

            {/* 2. Scope of Work */}
            <section className="space-y-3 print-avoid-break w-full min-w-0">
                <h2 className="text-base font-serif font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-1.5 uppercase tracking-wide">
                    <FileText className="w-4 h-4 text-primary shrink-0" /> {nextSection()}. Project Objectives &amp; Scope of Work
                </h2>
                <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line break-words min-w-0">
                    {data.scope || "The detailed project objectives, scope parameters, and technical requirements are set forth in this schedule."}
                </div>
            </section>

            {/* 3. Technical Architecture */}
            {data.technicalApproach && (
                <section className="space-y-3 print-avoid-break w-full min-w-0">
                    <h2 className="text-base font-serif font-bold text-foreground border-b border-border/60 pb-1.5 uppercase tracking-wide">
                        {nextSection()}. Technical Architecture &amp; Execution Methodology
                    </h2>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line break-words min-w-0">
                        {data.technicalApproach}
                    </p>
                </section>
            )}

            {/* 4. Deliverables */}
            {deliverablesList.length > 0 && (
                <section className="space-y-3 print-avoid-break w-full min-w-0">
                    <h2 className="text-base font-serif font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-1.5 uppercase tracking-wide">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> {nextSection()}. Schedule of Deliverables &amp; Outcomes
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full min-w-0">
                        {deliverablesList.map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/60 text-sm print-avoid-break w-full min-w-0 overflow-hidden break-words shadow-sm"
                            >
                                <span className="font-mono text-xs font-bold text-primary mt-0.5 shrink-0">{String(idx + 1).padStart(2, '0')}.</span>
                                <span className="text-foreground/90 min-w-0 break-words leading-relaxed whitespace-normal">{item}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 5. Timeline */}
            {data.timeline && (
                <section className="space-y-2 print-avoid-break w-full min-w-0">
                    <h2 className="text-base font-serif font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-1.5 uppercase tracking-wide">
                        <Calendar className="w-4 h-4 text-primary shrink-0" /> {nextSection()}. Target Timeline &amp; Delivery Schedule
                    </h2>
                    <p className="text-sm text-foreground/90 leading-relaxed break-words min-w-0">{data.timeline}</p>
                </section>
            )}

            {/* 6. Pricing */}
            <section className="space-y-3 print-avoid-break w-full min-w-0">
                <h2 className="text-base font-serif font-bold text-foreground border-b border-border/60 pb-1.5 uppercase tracking-wide">
                    {nextSection()}. Commercial Terms &amp; Investment Schedule
                </h2>

                <div className="border border-border rounded-lg overflow-x-auto print:overflow-visible w-full min-w-0 shadow-sm">
                    <table className="w-full text-left text-sm table-fixed min-w-[500px] sm:min-w-0">
                        <colgroup>
                            <col className="w-[52%] sm:w-[56%]" />
                            <col className="w-[12%] sm:w-[12%]" />
                            <col className="w-[18%] sm:w-[16%]" />
                            <col className="w-[18%] sm:w-[16%]" />
                        </colgroup>
                        <thead className="bg-muted/60 text-muted-foreground text-[11px] uppercase font-mono border-b border-border">
                            <tr>
                                <th className="p-3">Description &amp; Scope Breakdown</th>
                                <th className="p-3 text-center">Qty</th>
                                <th className="p-3 text-right">Rate</th>
                                <th className="p-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {pricingItems.length > 0 ? (
                                pricingItems.map((item, idx) => (
                                    <tr key={idx} className="print-avoid-break hover:bg-muted/20 transition-colors">
                                        <td className="p-3 font-medium text-foreground min-w-0 break-words">
                                            <div className="break-words font-semibold">{item.name}</div>
                                            {item.description && (
                                                <div className="text-xs text-muted-foreground font-normal mt-0.5 break-words whitespace-normal leading-relaxed">
                                                    {item.description}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 text-center text-muted-foreground font-mono shrink-0 whitespace-nowrap">{item.quantity || 1}</td>
                                        <td className="p-3 text-right text-muted-foreground font-mono shrink-0 whitespace-nowrap">
                                            {currencyFormatter.format(item.unitPrice || 0)}
                                        </td>
                                        <td className="p-3 text-right font-semibold text-foreground font-mono shrink-0 whitespace-nowrap">
                                            {currencyFormatter.format(item.total || (item.quantity || 1) * (item.unitPrice || 0))}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="p-4 text-center text-muted-foreground text-xs italic">
                                        No line items configured.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-muted/30 border-t-2 border-border font-mono text-sm divide-y divide-border/40">
                            {(data.discount ?? 0) > 0 && (
                                <tr>
                                    <td colSpan={3} className="p-2.5 text-right text-muted-foreground">Special Discount Applied:</td>
                                    <td className="p-2.5 text-right text-emerald-600 dark:text-emerald-400 font-semibold shrink-0 whitespace-nowrap">
                                        -{currencyFormatter.format(data.discount || 0)}
                                    </td>
                                </tr>
                            )}
                            {(data.tax ?? 0) > 0 && (
                                <tr>
                                    <td colSpan={3} className="p-2.5 text-right text-muted-foreground">Applicable Tax / VAT:</td>
                                    <td className="p-2.5 text-right text-foreground font-semibold shrink-0 whitespace-nowrap">
                                        +{currencyFormatter.format(data.tax || 0)}
                                    </td>
                                </tr>
                            )}
                            <tr className="bg-primary/5 font-semibold text-base">
                                <td colSpan={3} className="p-3 text-right text-foreground font-serif uppercase tracking-wider text-xs">Total Contract Value:</td>
                                <td className="p-3 text-right text-primary font-mono text-lg font-bold shrink-0 whitespace-nowrap">
                                    {currencyFormatter.format(data.total || 0)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Payment Method */}
                {cs.paymentMethod && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground mt-2 p-2.5 rounded-lg border border-border/60 bg-muted/20 min-w-0 break-words">
                        <CreditCard className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="min-w-0 break-words"><strong className="text-foreground">Accepted Payment Method:</strong> {cs.paymentMethod}</span>
                    </div>
                )}
            </section>

            {/* 7. General Terms */}
            <section className="space-y-2 text-xs text-muted-foreground print-avoid-break border-t border-border/70 pt-6 w-full min-w-0">
                <h3 className="font-bold text-foreground uppercase tracking-wider text-xs font-serif">
                    {nextSection()}. General Terms, Intellectual Property &amp; Payment Milestones
                </h3>
                <p className="leading-relaxed whitespace-pre-line break-words min-w-0">
                    {data.terms ||
                        "Standard agency terms apply: 50% deposit required upon acceptance to initiate sprint planning, with the remaining balance due upon milestone handover. All custom deliverables and intellectual property will transfer to Client upon receipt of final contract settlement."}
                </p>
            </section>

            {/* Optional Legal Clauses */}
            {(cs.includeConfidentiality || cs.includeIpClause || cs.includeLiabilityClause || cs.includeForceClause || cs.includeChangeOrder || cs.includeDisputeResolution || cs.governingLaw || cs.customClauses) && (
                <section className="space-y-4 print-avoid-break border-t border-border/70 pt-6 w-full min-w-0">
                    <h3 className="font-bold text-foreground uppercase tracking-wider text-xs font-serif">
                        {nextSection()}. Additional Legal Provisions
                    </h3>

                    <div className="space-y-3 text-xs text-muted-foreground w-full min-w-0">
                        {cs.includeConfidentiality && (
                            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-1 min-w-0 overflow-hidden break-words">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <Lock className="w-3 h-3 text-primary shrink-0" /> Confidentiality &amp; Non-Disclosure
                                </div>
                                <p className="leading-relaxed break-words min-w-0">Both parties agree to hold all non-public information exchanged under this Agreement in strict confidence and not to disclose such information to any third party without prior written consent. This obligation survives the termination of this Agreement for a period of two (2) years.</p>
                            </div>
                        )}

                        {cs.includeIpClause && (
                            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-1 min-w-0 overflow-hidden break-words">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <Lightbulb className="w-3 h-3 text-primary shrink-0" /> Intellectual Property &amp; Work-for-Hire
                                </div>
                                <p className="leading-relaxed break-words min-w-0">Upon receipt of full and final payment, all custom deliverables, source code, designs, and documentation created specifically for the Client under this Agreement shall become the sole intellectual property of the Client. Pre-existing tools, libraries, and proprietary frameworks used in delivery remain the property of the Service Provider.</p>
                            </div>
                        )}

                        {cs.includeLiabilityClause && (
                            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-1 min-w-0 overflow-hidden break-words">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <AlertTriangle className="w-3 h-3 text-primary shrink-0" /> Limitation of Liability
                                </div>
                                <p className="leading-relaxed break-words min-w-0">The total aggregate liability of the Service Provider under or in connection with this Agreement shall not exceed the total fees paid by the Client in the three (3) months preceding the claim. Neither party shall be liable for indirect, incidental, consequential, or punitive damages arising from the performance of this Agreement.</p>
                            </div>
                        )}

                        {cs.includeForceClause && (
                            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-1 min-w-0 overflow-hidden break-words">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <RefreshCw className="w-3 h-3 text-primary shrink-0" /> Force Majeure
                                </div>
                                <p className="leading-relaxed break-words min-w-0">Neither party shall be liable for delays or failures in performance resulting from causes beyond their reasonable control, including but not limited to natural disasters, governmental actions, internet or telecommunications outages, or other events constituting force majeure. The affected party shall promptly notify the other party and resume performance as soon as reasonably practicable.</p>
                            </div>
                        )}

                        {cs.includeChangeOrder && (
                            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-1 min-w-0 overflow-hidden break-words">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <Plus className="w-3 h-3 text-primary shrink-0" /> Change Order &amp; Scope Amendment Process
                                </div>
                                <p className="leading-relaxed break-words min-w-0">Any additions or material changes to the agreed scope of work must be documented in a written Change Order, mutually signed by both parties, prior to commencement of additional work. Change Orders may affect timeline and pricing and will be billed separately at the Service Provider&apos;s standard rates.</p>
                            </div>
                        )}

                        {cs.includeDisputeResolution && (
                            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-1 min-w-0 overflow-hidden break-words">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <Gavel className="w-3 h-3 text-primary shrink-0" /> Dispute Resolution
                                </div>
                                <p className="leading-relaxed break-words min-w-0">The parties agree to attempt to resolve any dispute through good-faith negotiation. If unresolved within thirty (30) days, the dispute shall be submitted to binding arbitration in accordance with applicable commercial arbitration rules. The prevailing party may be entitled to recover reasonable legal fees.</p>
                            </div>
                        )}

                        {cs.governingLaw && (
                            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-1 min-w-0 overflow-hidden break-words">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <Scale className="w-3 h-3 text-primary shrink-0" /> Governing Law &amp; Jurisdiction
                                </div>
                                <p className="leading-relaxed break-words min-w-0">This Agreement shall be governed by and construed in accordance with the laws of <strong className="text-foreground">{cs.governingLaw}</strong>. Any legal proceedings arising from this Agreement shall be conducted exclusively within the competent courts of {cs.governingLaw}.</p>
                            </div>
                        )}

                        {cs.customClauses && (
                            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-1 min-w-0 overflow-hidden break-words">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <FileText className="w-3 h-3 text-primary shrink-0" /> Additional Agreed Terms
                                </div>
                                <p className="leading-relaxed whitespace-pre-line break-words min-w-0">{cs.customClauses}</p>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Final: Signatures */}
            <footer className="proposal-sheet-footer pt-6 border-t-2 border-border/90 print-avoid-break space-y-4 w-full min-w-0">
                <h3 className="font-bold text-foreground uppercase tracking-wider text-xs font-serif">
                    {nextSection()}. Signatures &amp; Authorization
                </h3>
                <p className="text-[11px] text-muted-foreground break-words">
                    IN WITNESS WHEREOF, the parties hereto have caused this Statement of Work to be executed by their duly authorized representatives.
                </p>

                {data.status === "Approved" ? (
                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full min-w-0 overflow-hidden">
                        <div className="space-y-1 min-w-0 break-words">
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                                <ShieldCheck className="w-4 h-4 shrink-0" /> Digital Portal Sign-Off &amp; Verification Timestamp
                            </div>
                            <p className="text-xs text-muted-foreground break-words">
                                Approved via Client Portal by <strong className="text-foreground">{data.acceptedByName || "Client Signatory"}</strong>
                                {data.acceptedByTitle ? ` (${data.acceptedByTitle})` : ""} on{" "}
                                {data.acceptedAt ? safeFormatDate(data.acceptedAt, undefined, formattedCreatedDate) : formattedCreatedDate}.
                            </p>
                        </div>
                        {data.signatureData && (
                            <div className="mt-2 sm:mt-0 shrink-0 max-w-[200px]">
                                {data.signatureData.startsWith("data:image/") ? (
                                    <img
                                        src={data.signatureData}
                                        alt="Authorized Client Signature"
                                        className="max-h-12 max-w-full object-contain filter contrast-125"
                                    />
                                ) : (
                                    <span className="font-serif italic text-xl sm:text-2xl text-neutral-900 dark:text-neutral-100 tracking-wide break-words">
                                        {data.signatureData}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 pt-2 w-full min-w-0">
                        <div className="space-y-3 min-w-0">
                            <p className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Service Provider Authorization</p>
                            <div className="h-12 border-b border-border flex items-end font-serif italic text-sm text-foreground pb-1 truncate">
                                {agencyName} Representative
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">Date: {formattedCreatedDate}</div>
                        </div>
                        <div className="space-y-3 min-w-0">
                            <p className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Client Acceptance &amp; Execution</p>
                            <div className="h-12 border-b border-dashed border-border flex items-end text-xs text-muted-foreground pb-1">
                                Pending Digital Signature
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono truncate">Date: ________________________</div>
                        </div>
                    </div>
                )}
            </footer>

            {/* Reusable Legal Footprint Footer */}
            <ProposalDocumentFooter
                proposalCode={data.proposalCode || "OPT-2026-0001"}
                agencyRegistration={cs.agencyRegistration || "CS202612345"}
                agencyAddress={cs.agencyAddress || "4th Floor, Innovation Hub Building, Metro Manila, Philippines"}
                agencyPhone={cs.agencyPhone || "+63 (917) 555-1234"}
                agencyEmail={agencyEmail}
                currentPage={1}
                totalPages={1}
            />
        </div>
    );
}
