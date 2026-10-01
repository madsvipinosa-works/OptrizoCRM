"use client";

import React from "react";
import { CheckCircle2, Calendar, FileText, Building2, ShieldCheck, Briefcase, Phone, MapPin, Scale, CreditCard, Lock, Lightbulb, AlertTriangle, RefreshCw, Gavel, Plus } from "lucide-react";
import type { ContractSettings } from "@/features/proposals/actions";

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
}

interface ProposalDocumentSheetProps {
    data: ProposalDocumentData;
    agencyName?: string;
    agencyEmail?: string;
    agencyWebsite?: string;
}

export function ProposalDocumentSheet({
    data,
    agencyName = "Optrizo Digital Solutions",
    agencyEmail = "contact@optrizo.com",
    agencyWebsite = "https://optrizo.com",
}: ProposalDocumentSheetProps) {
    const cs = data.contractSettings || {};

    const formattedCreatedDate = data.createdAt
        ? new Date(data.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    const formattedValidDate = data.validUntil
        ? new Date(data.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "30 Days from Issue";

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
            className="proposal-document-sheet w-full max-w-[850px] mx-auto bg-card text-card-foreground shadow-2xl rounded-sm border border-border p-8 md:p-14 space-y-9 font-sans transition-all"
        >
            {/* 1. Formal Contract Header & Parties Matrix */}
            <header className="border-b-2 border-border/90 pb-8 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <span className="text-[11px] font-mono tracking-widest text-primary font-bold uppercase block">
                            Statement of Work &amp; Master Services Schedule
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground mt-0.5 tracking-tight">
                            {data.businessName ? `${data.businessName} — SOW` : "Client Project Statement of Work"}
                        </h1>
                    </div>
                    <div className="text-left md:text-right font-mono text-xs text-muted-foreground bg-muted/30 border border-border px-3 py-2 rounded">
                        <div>
                            CONTRACT REF: <span className="font-bold text-foreground">{data.proposalCode || "OPT-SOW-2026"}</span>
                        </div>
                        <div>STATUS: <span className="font-semibold text-foreground uppercase">{data.status || "DRAFT"}</span></div>
                    </div>
                </div>

                {/* Parties Summary Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded bg-muted/20 border border-border/70 text-xs">
                    {/* Service Provider */}
                    <div className="space-y-1">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-primary" /> Service Provider / Contractor
                        </span>
                        <div className="font-semibold text-foreground text-sm">{agencyName}</div>
                        <div className="text-muted-foreground">{agencyEmail} • {agencyWebsite}</div>
                        {cs.agencyPhone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3" /> {cs.agencyPhone}</div>}
                        {cs.agencyAddress && <div className="flex items-start gap-1 text-muted-foreground"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /> {cs.agencyAddress}</div>}
                        {cs.agencyRegistration && <div className="text-muted-foreground font-mono">Reg. No: {cs.agencyRegistration}</div>}
                    </div>
                    {/* Client */}
                    <div className="space-y-1 sm:border-l sm:border-border/60 sm:pl-4">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5 text-primary" /> Client / Principal
                        </span>
                        <div className="font-semibold text-foreground text-sm">
                            {data.businessName || "Valued Client Organization"}
                        </div>
                        {cs.clientContactPerson && <div className="text-muted-foreground">Attn: {cs.clientContactPerson}</div>}
                        <div className="text-muted-foreground">
                            {data.clientEmail ? `${data.clientEmail} (Authorized Representative)` : "Authorized Signatory"}
                        </div>
                        {cs.clientPhone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3" /> {cs.clientPhone}</div>}
                        {cs.clientAddress ? (
                            <div className="flex items-start gap-1 text-muted-foreground"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /> {cs.clientAddress}</div>
                        ) : (
                            <div className="text-muted-foreground/50 italic text-[10px]">Address: To be furnished upon registration</div>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center text-xs font-mono text-muted-foreground pt-1">
                    <div>EFFECTIVE DATE: <span className="text-foreground font-semibold">{formattedCreatedDate}</span></div>
                    <div>EXPIRATION DATE: <span className="text-foreground font-semibold">{formattedValidDate}</span></div>
                </div>
            </header>

            {/* 2. Scope of Work */}
            <section className="space-y-3 print-avoid-break">
                <h2 className="text-base font-serif font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-1.5 uppercase tracking-wide">
                    <FileText className="w-4 h-4 text-primary" /> {nextSection()}. Project Objectives &amp; Scope of Work
                </h2>
                <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                    {data.scope || "The detailed project objectives, scope parameters, and technical requirements are set forth in this schedule."}
                </div>
            </section>

            {/* 3. Technical Architecture */}
            {data.technicalApproach && (
                <section className="space-y-3 print-avoid-break">
                    <h2 className="text-base font-serif font-bold text-foreground border-b border-border/60 pb-1.5 uppercase tracking-wide">
                        {nextSection()}. Technical Architecture &amp; Execution Methodology
                    </h2>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                        {data.technicalApproach}
                    </p>
                </section>
            )}

            {/* 4. Deliverables */}
            {deliverablesList.length > 0 && (
                <section className="space-y-3 print-avoid-break">
                    <h2 className="text-base font-serif font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-1.5 uppercase tracking-wide">
                        <CheckCircle2 className="w-4 h-4 text-primary" /> {nextSection()}. Schedule of Deliverables &amp; Outcomes
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {deliverablesList.map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-2.5 p-3 rounded bg-muted/30 border border-border/60 text-sm print-avoid-break"
                            >
                                <span className="font-mono text-xs font-bold text-primary mt-0.5">{String(idx + 1).padStart(2, '0')}.</span>
                                <span className="text-foreground/90">{item}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 5. Timeline */}
            {data.timeline && (
                <section className="space-y-2 print-avoid-break">
                    <h2 className="text-base font-serif font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-1.5 uppercase tracking-wide">
                        <Calendar className="w-4 h-4 text-primary" /> {nextSection()}. Target Timeline &amp; Delivery Schedule
                    </h2>
                    <p className="text-sm text-foreground/90 leading-relaxed">{data.timeline}</p>
                </section>
            )}

            {/* 6. Pricing */}
            <section className="space-y-3 print-avoid-break">
                <h2 className="text-base font-serif font-bold text-foreground border-b border-border/60 pb-1.5 uppercase tracking-wide">
                    {nextSection()}. Commercial Terms &amp; Investment Schedule
                </h2>

                <div className="border border-border rounded overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/60 text-muted-foreground text-[11px] uppercase font-mono border-b border-border">
                            <tr>
                                <th className="p-3">Description &amp; Scope Breakdown</th>
                                <th className="p-3 text-center w-16">Qty</th>
                                <th className="p-3 text-right w-28">Rate</th>
                                <th className="p-3 text-right w-28">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {pricingItems.length > 0 ? (
                                pricingItems.map((item, idx) => (
                                    <tr key={idx} className="print-avoid-break">
                                        <td className="p-3 font-medium text-foreground">
                                            {item.name}
                                            {item.description && (
                                                <div className="text-xs text-muted-foreground font-normal mt-0.5">{item.description}</div>
                                            )}
                                        </td>
                                        <td className="p-3 text-center text-muted-foreground font-mono">{item.quantity || 1}</td>
                                        <td className="p-3 text-right text-muted-foreground font-mono">
                                            {currencyFormatter.format(item.unitPrice || 0)}
                                        </td>
                                        <td className="p-3 text-right font-semibold text-foreground font-mono">
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
                                    <td className="p-2.5 text-right text-emerald-600 dark:text-emerald-400">
                                        -{currencyFormatter.format(data.discount || 0)}
                                    </td>
                                </tr>
                            )}
                            {(data.tax ?? 0) > 0 && (
                                <tr>
                                    <td colSpan={3} className="p-2.5 text-right text-muted-foreground">Applicable Tax / VAT:</td>
                                    <td className="p-2.5 text-right text-foreground">
                                        +{currencyFormatter.format(data.tax || 0)}
                                    </td>
                                </tr>
                            )}
                            <tr className="bg-primary/5 font-semibold text-base">
                                <td colSpan={3} className="p-3 text-right text-foreground font-serif uppercase tracking-wider text-xs">Total Contract Value:</td>
                                <td className="p-3 text-right text-primary font-mono text-lg font-bold">
                                    {currencyFormatter.format(data.total || 0)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Payment Method */}
                {cs.paymentMethod && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground mt-2 p-2.5 rounded border border-border/60 bg-muted/20">
                        <CreditCard className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span><strong className="text-foreground">Accepted Payment Method:</strong> {cs.paymentMethod}</span>
                    </div>
                )}
            </section>

            {/* 7. General Terms */}
            <section className="space-y-2 text-xs text-muted-foreground print-avoid-break border-t border-border/70 pt-6">
                <h3 className="font-bold text-foreground uppercase tracking-wider text-xs font-serif">
                    {nextSection()}. General Terms, Intellectual Property &amp; Payment Milestones
                </h3>
                <p className="leading-relaxed whitespace-pre-line">
                    {data.terms ||
                        "Standard agency terms apply: 50% deposit required upon acceptance to initiate sprint planning, with the remaining balance due upon milestone handover. All custom deliverables and intellectual property will transfer to Client upon receipt of final contract settlement."}
                </p>
            </section>

            {/* Optional Legal Clauses */}
            {(cs.includeConfidentiality || cs.includeIpClause || cs.includeLiabilityClause || cs.includeForceClause || cs.includeChangeOrder || cs.includeDisputeResolution || cs.governingLaw || cs.customClauses) && (
                <section className="space-y-4 print-avoid-break border-t border-border/70 pt-6">
                    <h3 className="font-bold text-foreground uppercase tracking-wider text-xs font-serif">
                        {nextSection()}. Additional Legal Provisions
                    </h3>

                    <div className="space-y-3 text-xs text-muted-foreground">
                        {cs.includeConfidentiality && (
                            <div className="p-3 rounded border border-border/60 bg-muted/20 space-y-1">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <Lock className="w-3 h-3 text-primary" /> Confidentiality &amp; Non-Disclosure
                                </div>
                                <p className="leading-relaxed">Both parties agree to hold all non-public information exchanged under this Agreement in strict confidence and not to disclose such information to any third party without prior written consent. This obligation survives the termination of this Agreement for a period of two (2) years.</p>
                            </div>
                        )}

                        {cs.includeIpClause && (
                            <div className="p-3 rounded border border-border/60 bg-muted/20 space-y-1">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <Lightbulb className="w-3 h-3 text-primary" /> Intellectual Property &amp; Work-for-Hire
                                </div>
                                <p className="leading-relaxed">Upon receipt of full and final payment, all custom deliverables, source code, designs, and documentation created specifically for the Client under this Agreement shall become the sole intellectual property of the Client. Pre-existing tools, libraries, and proprietary frameworks used in delivery remain the property of the Service Provider.</p>
                            </div>
                        )}

                        {cs.includeLiabilityClause && (
                            <div className="p-3 rounded border border-border/60 bg-muted/20 space-y-1">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <AlertTriangle className="w-3 h-3 text-primary" /> Limitation of Liability
                                </div>
                                <p className="leading-relaxed">The total aggregate liability of the Service Provider under or in connection with this Agreement shall not exceed the total fees paid by the Client in the three (3) months preceding the claim. Neither party shall be liable for indirect, incidental, consequential, or punitive damages arising from the performance of this Agreement.</p>
                            </div>
                        )}

                        {cs.includeForceClause && (
                            <div className="p-3 rounded border border-border/60 bg-muted/20 space-y-1">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <RefreshCw className="w-3 h-3 text-primary" /> Force Majeure
                                </div>
                                <p className="leading-relaxed">Neither party shall be liable for delays or failures in performance resulting from causes beyond their reasonable control, including but not limited to natural disasters, governmental actions, internet or telecommunications outages, or other events constituting force majeure. The affected party shall promptly notify the other party and resume performance as soon as reasonably practicable.</p>
                            </div>
                        )}

                        {cs.includeChangeOrder && (
                            <div className="p-3 rounded border border-border/60 bg-muted/20 space-y-1">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <Plus className="w-3 h-3 text-primary" /> Change Order &amp; Scope Amendment Process
                                </div>
                                <p className="leading-relaxed">Any additions or material changes to the agreed scope of work must be documented in a written Change Order, mutually signed by both parties, prior to commencement of additional work. Change Orders may affect timeline and pricing and will be billed separately at the Service Provider&apos;s standard rates.</p>
                            </div>
                        )}

                        {cs.includeDisputeResolution && (
                            <div className="p-3 rounded border border-border/60 bg-muted/20 space-y-1">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <Gavel className="w-3 h-3 text-primary" /> Dispute Resolution
                                </div>
                                <p className="leading-relaxed">The parties agree to attempt to resolve any dispute through good-faith negotiation. If unresolved within thirty (30) days, the dispute shall be submitted to binding arbitration in accordance with applicable commercial arbitration rules. The prevailing party may be entitled to recover reasonable legal fees.</p>
                            </div>
                        )}

                        {cs.governingLaw && (
                            <div className="p-3 rounded border border-border/60 bg-muted/20 space-y-1">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <Scale className="w-3 h-3 text-primary" /> Governing Law &amp; Jurisdiction
                                </div>
                                <p className="leading-relaxed">This Agreement shall be governed by and construed in accordance with the laws of <strong className="text-foreground">{cs.governingLaw}</strong>. Any legal proceedings arising from this Agreement shall be conducted exclusively within the competent courts of {cs.governingLaw}.</p>
                            </div>
                        )}

                        {cs.customClauses && (
                            <div className="p-3 rounded border border-border/60 bg-muted/20 space-y-1">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                                    <FileText className="w-3 h-3 text-primary" /> Additional Agreed Terms
                                </div>
                                <p className="leading-relaxed whitespace-pre-line">{cs.customClauses}</p>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Final: Signatures */}
            <footer className="pt-6 border-t-2 border-border/90 print-avoid-break space-y-4">
                <h3 className="font-bold text-foreground uppercase tracking-wider text-xs font-serif">
                    {nextSection()}. Signatures &amp; Authorization
                </h3>
                <p className="text-[11px] text-muted-foreground">
                    IN WITNESS WHEREOF, the parties hereto have caused this Statement of Work to be executed by their duly authorized representatives.
                </p>

                {data.status === "Approved" ? (
                    <div className="p-4 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                                <ShieldCheck className="w-4 h-4" /> Legally Executed Agreement (ESIGN / UETA Verified)
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Executed by <strong className="text-foreground">{data.acceptedByName || "Client Signatory"}</strong>
                                {data.acceptedByTitle ? ` (${data.acceptedByTitle})` : ""} on{" "}
                                {data.acceptedAt ? new Date(data.acceptedAt).toLocaleString() : formattedCreatedDate}.
                            </p>
                        </div>
                        {data.signatureData && (
                            <div className="mt-2">
                                {data.signatureData.startsWith("data:image/") ? (
                                    <img
                                        src={data.signatureData}
                                        alt="Authorized Client Signature"
                                        className="max-h-14 max-w-[220px] object-contain filter contrast-125"
                                    />
                                ) : (
                                    <span className="font-serif italic text-2xl text-neutral-900 dark:text-neutral-100 tracking-wide">
                                        {data.signatureData}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-8 pt-2">
                        <div className="space-y-3">
                            <p className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Service Provider Authorization</p>
                            <div className="h-12 border-b border-border flex items-end font-serif italic text-sm text-foreground pb-1">
                                {agencyName} Representative
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">Date: {formattedCreatedDate}</div>
                        </div>
                        <div className="space-y-3">
                            <p className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Client Acceptance &amp; Execution</p>
                            <div className="h-12 border-b border-dashed border-border flex items-end text-xs text-muted-foreground pb-1">
                                Pending Digital Signature
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">Date: ________________________</div>
                        </div>
                    </div>
                )}
            </footer>
        </div>
    );
}
