"use client";

import React from "react";
import { CheckCircle2, Calendar, FileText, Building2, ShieldCheck, Briefcase } from "lucide-react";

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
                            Statement of Work & Master Services Schedule
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
                    <div className="space-y-1">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-primary" /> Service Provider / Contractor
                        </span>
                        <div className="font-semibold text-foreground text-sm">{agencyName}</div>
                        <div className="text-muted-foreground">{agencyEmail} • {agencyWebsite}</div>
                    </div>
                    <div className="space-y-1 sm:border-l sm:border-border/60 sm:pl-4">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5 text-primary" /> Client / Principal
                        </span>
                        <div className="font-semibold text-foreground text-sm">
                            {data.businessName || "Valued Client Organization"}
                        </div>
                        <div className="text-muted-foreground">
                            {data.clientEmail ? `${data.clientEmail} (Authorized Representative)` : "Authorized Signatory"}
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center text-xs font-mono text-muted-foreground pt-1">
                    <div>EFFECTIVE DATE: <span className="text-foreground font-semibold">{formattedCreatedDate}</span></div>
                    <div>EXPIRATION DATE: <span className="text-foreground font-semibold">{formattedValidDate}</span></div>
                </div>
            </header>

            {/* 2. Scope of Work & Recitals */}
            <section className="space-y-3 print-avoid-break">
                <h2 className="text-base font-serif font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-1.5 uppercase tracking-wide">
                    <FileText className="w-4 h-4 text-primary" /> 1. Project Objectives & Scope of Work
                </h2>
                <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                    {data.scope || "The detailed project objectives, scope parameters, and technical requirements are set forth in this schedule."}
                </div>
            </section>

            {/* 3. Technical Architecture & Methodology */}
            {data.technicalApproach && (
                <section className="space-y-3 print-avoid-break">
                    <h2 className="text-base font-serif font-bold text-foreground border-b border-border/60 pb-1.5 uppercase tracking-wide">
                        2. Technical Architecture & Execution Methodology
                    </h2>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                        {data.technicalApproach}
                    </p>
                </section>
            )}

            {/* 4. Schedule of Deliverables & Outcomes */}
            {deliverablesList.length > 0 && (
                <section className="space-y-3 print-avoid-break">
                    <h2 className="text-base font-serif font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-1.5 uppercase tracking-wide">
                        <CheckCircle2 className="w-4 h-4 text-primary" /> 3. Schedule of Deliverables & Outcomes
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

            {/* 5. Timeline & Milestones */}
            {data.timeline && (
                <section className="space-y-2 print-avoid-break">
                    <h2 className="text-base font-serif font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-1.5 uppercase tracking-wide">
                        <Calendar className="w-4 h-4 text-primary" /> 4. Target Timeline & Delivery Schedule
                    </h2>
                    <p className="text-sm text-foreground/90 leading-relaxed">{data.timeline}</p>
                </section>
            )}

            {/* 6. Commercial Terms & Investment Schedule */}
            <section className="space-y-3 print-avoid-break">
                <h2 className="text-base font-serif font-bold text-foreground border-b border-border/60 pb-1.5 uppercase tracking-wide">
                    5. Commercial Terms & Investment Schedule
                </h2>

                <div className="border border-border rounded overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/60 text-muted-foreground text-[11px] uppercase font-mono border-b border-border">
                            <tr>
                                <th className="p-3">Description & Scope Breakdown</th>
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
            </section>

            {/* 7. General Terms & Payment Milestone Schedule */}
            <section className="space-y-2 text-xs text-muted-foreground print-avoid-break border-t border-border/70 pt-6">
                <h3 className="font-bold text-foreground uppercase tracking-wider text-xs font-serif">
                    6. General Terms, Intellectual Property & Payment Milestones
                </h3>
                <p className="leading-relaxed whitespace-pre-line">
                    {data.terms ||
                        "Standard agency terms apply: 50% deposit required upon acceptance to initiate sprint planning, with the remaining balance due upon milestone handover. All custom deliverables and intellectual property will transfer to Client upon receipt of final contract settlement."}
                </p>
            </section>

            {/* 8. Execution & Legal Signature Block */}
            <footer className="pt-6 border-t-2 border-border/90 print-avoid-break space-y-4">
                <h3 className="font-bold text-foreground uppercase tracking-wider text-xs font-serif">
                    7. Signatures & Authorization
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
                            <p className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Client Acceptance & Execution</p>
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
