"use client";

/**
 * The proposal document (mockups 10d, 17b, "Ref · Client: signed proposal document").
 * One document for the PM preview, the client view and the signed copy. Sections, in the mockup order:
 * 1 Introduction (and About Optrizo), 2 Your needs and goals, 3 Proposed solution, 4 Scope of work,
 * 5 Timeline and milestones, 6 Price, 7 How we work, 8 Project team, 9 Terms and conditions, 10 Next steps,
 * 11 Signatures (priced versions only). Always a white page (like the printed copy), set in Geist like the rest of Optrizo.
 */

import React from "react";
import type { ContractSettings } from "@/features/proposals/actions";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/datetime";
import { STANDARD_SECTIONS } from "@/features/proposals/standard-sections";
import { PAYMENT_TRIGGERS } from "@/features/proposals/constants";

const TRIGGER_LABEL = Object.fromEntries(PAYMENT_TRIGGERS);

export interface PricingLineItem {
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface ProposalDocumentData {
    proposalCode?: string | null;
    /** Version number, shown beside the proposal number. */
    version?: number | null;
    businessName?: string | null;
    clientEmail?: string | null;
    /** Name of the project: the document title. */
    projectName?: string | null;
    scope?: string | null;
    /** What is not included in the scope. */
    exclusions?: string | null;
    technicalApproach?: string | null;
    deliverables?: string[] | null;
    timeline?: string | null;
    pricingStructure?: PricingLineItem[] | null;
    subtotal?: number | null;
    priceMode?: "to_be_discussed" | "priced" | string | null;
    currency?: "PHP" | "USD" | string | null;
    totalPrice?: number | null;
    discount?: number | null;
    tax?: number | null;
    total?: number | null;
    needsGoals?: string | { needs?: string; goals?: string } | null;
    milestones?: Array<{
        key: string;
        title: string;
        description?: string;
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
    terms?: string | null;
    validUntil?: string | Date | null;
    status?: string;
    // Signature audit
    acceptedByName?: string | null;
    acceptedByTitle?: string | null;
    acceptedAt?: string | Date | null;
    signatureData?: string | null;
    createdAt?: string | Date | null;
    contractSettings?: ContractSettings | null;
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

const MS_DAY = 24 * 60 * 60 * 1000;

const toDate = (val: string | number | Date | null | undefined) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};
const fmt = (val: string | number | Date | null | undefined, fallback = "") => {
    const d = toDate(val);
    return d ? formatDate(d) : fallback;
};
const fmtShort = (val: string | number | Date | null | undefined) => {
    const d = toDate(val);
    return d ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "Asia/Manila" }).format(d) : "";
};

/** Lines of free text as bullet items: one per line, without a leading "-" or "•". */
const bullets = (text: string | null | undefined) =>
    (text ?? "")
        .split("\n")
        .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
        .filter(Boolean);

/** Needs and goals arrive as an object, or as one text with "Client Needs:" / "Goals:" headings (older rows). */
function splitNeedsGoals(value: ProposalDocumentData["needsGoals"]): { needs: string[]; goals: string[] } {
    if (!value) return { needs: [], goals: [] };
    if (typeof value === "object") return { needs: bullets(value.needs), goals: bullets(value.goals) };
    const [needsPart, goalsPart = ""] = value.split(/\n?\s*Goals:\s*\n?/i);
    return { needs: bullets(needsPart.replace(/^\s*Client Needs:\s*/i, "")), goals: bullets(goalsPart) };
}

/** "2 weeks", "2.5 weeks": rounded to half weeks, at least 1. */
function duration(start?: string | null, end?: string | null) {
    const s = toDate(start);
    const e = toDate(end);
    if (!s || !e) return "";
    const weeks = Math.max(1, Math.round(((e.getTime() - s.getTime()) / MS_DAY + 1) / 7 * 2) / 2);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

/** A "Label: text" line shows the label in bold, as in the mockup's lists. */
function LabelledItem({ text }: { text: string }) {
    const i = text.indexOf(":");
    if (i > 0 && i < 40) {
        return (
            <li>
                <strong className="font-semibold text-foreground">{text.slice(0, i)}:</strong>
                {text.slice(i + 1)}
            </li>
        );
    }
    return <li>{text}</li>;
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <section className="print-avoid-break min-w-0 space-y-2.5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
                <span className="text-brand-deep">{n}.</span> {title}
            </h2>
            {children}
        </section>
    );
}

const listClass = "list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground/90 marker:text-muted-foreground";
const tableClass = "w-full text-left text-sm";
const thClass = "border-b border-border py-1.5 pr-3 text-xs font-medium text-muted-foreground";
const tdClass = "border-b border-border/60 py-2 pr-3 align-top";

export function ProposalDocumentSheet({
    data,
    agencyName = "Optrizo Digital Solutions",
    agencyEmail = "contact@optrizo.com",
    agencyLogoUrl,
}: ProposalDocumentSheetProps) {
    const cs = data.contractSettings || {};
    const logo = agencyLogoUrl || data.agencyLogoUrl || null;
    const business = data.businessName || "the client";
    const project = data.projectName?.trim() || "Software project";

    const currency = data.currency === "USD" ? "USD" : "PHP";
    const money = new Intl.NumberFormat(currency === "PHP" ? "en-PH" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 });
    const priced = data.priceMode === "priced";
    const total = data.totalPrice ?? data.total ?? 0;

    const { needs, goals } = splitNeedsGoals(data.needsGoals);
    const solution = bullets(data.technicalApproach);
    const milestones = data.milestones ?? [];
    const dated = milestones.filter((m) => m.startDate && m.endDate);
    const firstStart = dated[0]?.startDate;
    const lastEnd = dated.at(-1)?.endDate;
    const months = firstStart && lastEnd ? Math.max(1, Math.round((toDate(lastEnd)!.getTime() - toDate(firstStart)!.getTime()) / MS_DAY / 30)) : null;

    const standard = Object.fromEntries(STANDARD_SECTIONS.map((s) => [s.key, s]));
    const termsText = (data.terms ?? "").trim();
    const customTerms = termsText && !/^Standard (Agency Terms:|agency terms apply)/i.test(termsText) ? bullets(termsText) : null;
    const extraClauses = [
        cs.includeConfidentiality && "Confidentiality and non-disclosure: both parties keep non-public information confidential for two years after the agreement ends.",
        cs.includeIpClause && "Intellectual property: after full payment, the client owns the custom deliverables; Optrizo keeps its own tools and libraries.",
        cs.includeLiabilityClause && "Limitation of liability: limited to the fees paid in the three months before a claim; no indirect damages.",
        cs.includeForceClause && "Force majeure: neither party is liable for delays caused by events outside its control.",
        cs.includeChangeOrder && "Change orders: changes to scope are agreed in writing first and may change the timeline and price.",
        cs.includeDisputeResolution && "Dispute resolution: good-faith negotiation first; unresolved after 30 days, binding arbitration.",
        cs.governingLaw && `Governing law: the laws of ${cs.governingLaw}.`,
        ...bullets(cs.customClauses),
    ].filter(Boolean) as string[];

    const signed = data.status === "signed";
    let n = 0;
    const next = () => ++n;

    return (
        <div
            id="printable-proposal"
            className="light proposal-document-sheet mx-auto w-full min-w-0 max-w-[850px] space-y-8 overflow-hidden rounded-xl border border-border bg-card p-6 text-card-foreground sm:p-10 md:p-12 print:max-w-none print:overflow-visible print:border-none print:bg-white print:p-0 print:text-neutral-900"
        >
            {/* Letterhead: logo left, proposal number, version and dates right */}
            <header className="proposal-sheet-header min-w-0 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-brand-deep pb-4">
                    {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- uploaded logo of any size, also printed
                        <img src={logo} alt={agencyName} className="h-9 w-auto max-w-[170px] object-contain object-left" />
                    ) : (
                        <span className="font-semibold text-foreground">{agencyName}</span>
                    )}
                    <div className="text-right text-xs leading-relaxed text-muted-foreground tabular-nums">
                        <p>Proposal no. {data.proposalCode || "Not issued"}</p>
                        <p suppressHydrationWarning>
                            Version {data.version ?? 1} · issued {fmt(data.createdAt, fmt(new Date()))}
                        </p>
                        <p suppressHydrationWarning>Valid until {fmt(data.validUntil, "30 days from issue")}</p>
                    </div>
                </div>

                <div className="space-y-1">
                    <p className="text-sm font-medium text-brand-deep">Software development proposal</p>
                    <h1 className="break-words text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{project}</h1>
                </div>

                <dl className="grid gap-4 rounded-lg bg-muted/60 p-4 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Prepared for</dt>
                        <dd className="break-words font-semibold text-foreground">{data.businessName || "Client"}</dd>
                        {(cs.clientContactPerson || data.clientEmail) && (
                            <dd className="break-words text-muted-foreground">{cs.clientContactPerson || data.clientEmail}</dd>
                        )}
                    </div>
                    <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Prepared by</dt>
                        <dd className="font-semibold text-foreground">{agencyName}</dd>
                        <dd className="text-muted-foreground">Project Manager</dd>
                    </div>
                </dl>
            </header>

            <Section n={next()} title="Introduction">
                <p className="text-sm leading-relaxed text-foreground/90">
                    This proposal describes the software {agencyName.split(" ")[0]} will build for {business}, how the work will be done, and what it will cost.
                </p>
                {data.scope?.trim() && <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{data.scope}</p>}
                <h3 className="pt-1 text-sm font-semibold text-foreground">About Optrizo</h3>
                <p className="text-sm leading-relaxed text-foreground/90">{standard.about?.lines.join(" ")}</p>
            </Section>

            <Section n={next()} title="Your needs and goals">
                {needs.length === 0 && goals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Taken from the discovery meeting.</p>
                ) : (
                    <>
                        {needs.length > 0 && (
                            <>
                                <p className="text-sm leading-relaxed text-foreground/90">From our discovery meeting, we understand that:</p>
                                <ul className={listClass}>{needs.map((t) => <li key={t}>{t}</li>)}</ul>
                            </>
                        )}
                        {goals.length > 0 && (
                            <>
                                <h3 className="pt-1 text-sm font-semibold text-foreground">Goals</h3>
                                <ul className={listClass}>{goals.map((t) => <li key={t}>{t}</li>)}</ul>
                            </>
                        )}
                    </>
                )}
            </Section>

            <Section n={next()} title="Proposed solution">
                {solution.length > 1 ? (
                    <ul className={listClass}>{solution.map((t) => <LabelledItem key={t} text={t} />)}</ul>
                ) : (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{solution[0] || "Described with you during Requirements."}</p>
                )}
                {(data.deliverables ?? []).length > 0 && (
                    <ul className={listClass}>{(data.deliverables ?? []).map((t) => <li key={t}>{t}</li>)}</ul>
                )}
            </Section>

            <Section n={next()} title="Scope of work">
                {milestones.length > 0 && (
                    <table className={tableClass}>
                        <thead>
                            <tr>
                                <th className={thClass}>Phase</th>
                                <th className={thClass}>What is done</th>
                            </tr>
                        </thead>
                        <tbody>
                            {milestones.map((m) => (
                                <tr key={m.key}>
                                    <td className={cn(tdClass, "w-1/3 text-foreground")}>{m.title}</td>
                                    <td className={cn(tdClass, "text-muted-foreground")}>{m.description}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {data.exclusions?.trim() && (
                    <>
                        <h3 className="pt-1 text-sm font-semibold text-foreground">Not included</h3>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{data.exclusions}</p>
                    </>
                )}
            </Section>

            <Section n={next()} title="Timeline and milestones">
                {dated.length > 0 ? (
                    <>
                        <p className="text-sm text-foreground/90" suppressHydrationWarning>
                            Estimated duration: about {months} {months === 1 ? "month" : "months"}, {fmt(firstStart)} to {fmt(lastEnd)}.
                        </p>
                        <table className={tableClass}>
                            <thead>
                                <tr>
                                    <th className={thClass}>Milestone</th>
                                    <th className={thClass}>Dates</th>
                                    <th className={cn(thClass, "text-right")}>Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {milestones.map((m) => (
                                    <tr key={m.key}>
                                        <td className={cn(tdClass, "text-foreground")}>{m.title}</td>
                                        <td className={cn(tdClass, "tabular-nums text-muted-foreground")} suppressHydrationWarning>
                                            {m.startDate && m.endDate ? `${fmtShort(m.startDate)} – ${fmtShort(m.endDate)}` : "To be set"}
                                        </td>
                                        <td className={cn(tdClass, "text-right tabular-nums text-foreground")}>{duration(m.startDate, m.endDate)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                ) : (
                    <p className="text-sm text-foreground/90">{data.timeline || "Dates are agreed during Requirements."}</p>
                )}
            </Section>

            <Section n={next()} title="Price">
                {priced ? (
                    <>
                        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-brand-soft/60 px-4 py-3">
                            <span className="text-sm text-foreground">Total price</span>
                            <span className="text-xl font-semibold tabular-nums text-foreground">{money.format(total)}</span>
                        </div>
                        {(data.paymentScheduleItems ?? []).length > 0 && (
                            <table className={tableClass}>
                                <thead>
                                    <tr>
                                        <th className={thClass}>Payment</th>
                                        <th className={thClass}>When</th>
                                        <th className={cn(thClass, "text-right")}>Percent</th>
                                        <th className={cn(thClass, "text-right")}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.paymentScheduleItems ?? []).map((p, i) => (
                                        <tr key={p.id ?? `${p.label}-${i}`}>
                                            <td className={cn(tdClass, "text-foreground")}>{p.label}</td>
                                            <td className={cn(tdClass, "text-muted-foreground")}>{TRIGGER_LABEL[p.trigger] ?? p.trigger.replace(/_/g, " ")}</td>
                                            <td className={cn(tdClass, "text-right tabular-nums")}>{p.percent}%</td>
                                            <td className={cn(tdClass, "text-right tabular-nums text-foreground")}>{money.format(Math.round((total * p.percent) / 100))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {cs.paymentMethod && <p className="text-sm text-foreground/90">Accepted payment method: {cs.paymentMethod}</p>}
                    </>
                ) : data.priceMode === "to_be_discussed" ? (
                    <p className="rounded-lg bg-brand-soft/60 px-4 py-3 text-sm leading-relaxed text-foreground">
                        <strong className="font-semibold">Price to be discussed.</strong> {agencyName.split(" ")[0]} will meet with you to discuss your budget and the price for this
                        scope. A priced version of this proposal will follow that meeting.
                    </p>
                ) : (data.pricingStructure ?? []).length > 0 ? (
                    // Older proposals priced by line items.
                    <table className={tableClass}>
                        <thead>
                            <tr>
                                <th className={thClass}>Item</th>
                                <th className={cn(thClass, "text-right")}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data.pricingStructure ?? []).map((item, i) => (
                                <tr key={`${item.name}-${i}`}>
                                    <td className={cn(tdClass, "text-foreground")}>{item.name}</td>
                                    <td className={cn(tdClass, "text-right tabular-nums")}>{money.format(item.total || (item.quantity || 1) * (item.unitPrice || 0))}</td>
                                </tr>
                            ))}
                            <tr>
                                <td className="py-2 pr-3 font-semibold text-foreground">Total</td>
                                <td className="py-2 text-right font-semibold tabular-nums text-foreground">{money.format(data.total || 0)}</td>
                            </tr>
                        </tbody>
                    </table>
                ) : (
                    <p className="text-sm text-muted-foreground">Price to follow.</p>
                )}
            </Section>

            <Section n={next()} title="How we work">
                <ul className={listClass}>{standard.how_we_work?.lines.map((t) => <LabelledItem key={t} text={t.replace(/^- /, "")} />)}</ul>
            </Section>

            <Section n={next()} title="Project team">
                <table className={tableClass}>
                    <thead>
                        <tr>
                            <th className={thClass}>Role</th>
                            <th className={thClass}>Responsibility</th>
                        </tr>
                    </thead>
                    <tbody>
                        {standard.project_team?.lines.map((line) => {
                            const [role, ...rest] = line.replace(/^- /, "").split(":");
                            return (
                                <tr key={line}>
                                    <td className={cn(tdClass, "w-1/3 text-foreground")}>{role}</td>
                                    <td className={cn(tdClass, "text-muted-foreground")}>{rest.join(":").trim()}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </Section>

            <Section n={next()} title="Terms and conditions">
                <ul className={listClass}>
                    {(customTerms ?? standard.terms?.lines.map((t) => t.replace(/^- /, "")) ?? []).map((t) => (
                        <LabelledItem key={t} text={t} />
                    ))}
                    {extraClauses.map((t) => (
                        <LabelledItem key={t} text={t} />
                    ))}
                </ul>
            </Section>

            <Section n={next()} title="Next steps">
                <ul className={listClass}>
                    {(priced
                        ? standard.next_steps?.lines.map((t) => t.replace(/^- /, ""))
                        : [
                              "Review this proposal and request changes to the scope or timeline in the client portal.",
                              "Confirm a date for the budget and pricing meeting.",
                              "After the meeting, you receive a priced version to sign.",
                          ]
                    )?.map((t) => <li key={t}>{t}</li>)}
                </ul>
                {!priced && (
                    <p className="rounded-lg bg-stage-negotiation/15 px-4 py-2.5 text-sm text-foreground">This version has no price and cannot be signed.</p>
                )}
            </Section>

            {/* Signature lines only on a priced version: they fill in when the client signs online or the PM records a paper signature. */}
            {priced && (
                <footer className="proposal-sheet-footer print-avoid-break min-w-0 space-y-4">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                        <span className="text-brand-deep">{next()}.</span> Signatures
                    </h2>
                    <div className="grid gap-8 sm:grid-cols-2">
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">For {data.businessName || "the client"}</p>
                            <div className="flex h-14 items-end border-b border-foreground/40 pb-1">
                                {signed && data.signatureData ? (
                                    data.signatureData.startsWith("data:image/") ? (
                                        // eslint-disable-next-line @next/next/no-img-element -- signature captured as a data URL
                                        <img src={data.signatureData} alt={`Signature of ${data.acceptedByName || "the client"}`} className="max-h-12 max-w-full object-contain" />
                                    ) : (
                                        <span className="font-serif text-2xl italic text-foreground">{data.signatureData}</span>
                                    )
                                ) : null}
                            </div>
                            <p className="text-sm text-foreground">
                                {signed ? data.acceptedByName || "Client" : "Name"}
                                {signed && data.acceptedByTitle ? `, ${data.acceptedByTitle}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                                Date: {signed ? fmt(data.acceptedAt, fmt(new Date())) : "________________"}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">For {agencyName}</p>
                            <div className="h-14 border-b border-foreground/40" />
                            <p className="text-sm text-foreground">Project Manager</p>
                            <p className="text-xs text-muted-foreground">Date: ________________</p>
                        </div>
                    </div>
                </footer>
            )}

            {/* One quiet line, as in the mockup. */}
            <p className="proposal-document-footer flex flex-wrap justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                <span>{agencyName} · Confidential</span>
                <span className="tabular-nums">
                    {[cs.agencyRegistration && `SEC ${cs.agencyRegistration}`, cs.agencyPhone, agencyEmail].filter(Boolean).join(" · ")}
                </span>
            </p>
        </div>
    );
}
