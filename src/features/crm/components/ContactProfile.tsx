"use client";

/**
 * Contact profile (Claude Design sample "SalesContactProfile").
 * Header: back link, name with type, business · since · last interaction,
 * and two actions. Left: profile facts and linked records (deal, proposal,
 * project). Right: interaction history as a table, filterable by type.
 */

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ContactProfileData = {
    id: string;
    name: string;
    business: string | null;
    email: string | null;
    phone: string | null;
    preferredContact: string | null;
    role: string | null;
    industry: string | null;
    clientType: string | null;
    source: string | null;
    createdAt: string;
    clientSince: string | null;
    lastContactAt: string | null;
    type: "lead" | "client" | "past_client";
    stage: string;
    service: string | null;
    urgency: string | null;
    proposals: { id: string; version: number; status: string; totalPrice: number | null; currency: string | null; sentAt: string | null; signedAt: string | null }[];
    project: { title: string; status: string; progress: number; completedAt: string | null } | null;
    history: { id: string; type: string; content: string; createdAt: string; by: string | null }[];
};

const TYPE_META: Record<ContactProfileData["type"], { label: string; chip: string }> = {
    lead: { label: "Lead", chip: "bg-stage-new/12 ring-stage-new/30" },
    client: { label: "Client", chip: "bg-success/14 ring-success/30" },
    past_client: { label: "Past client", chip: "bg-foreground/[0.06] ring-border" },
};

const STAGE_LABEL: Record<string, string> = {
    "New Lead": "New lead",
    "Discovery & Qualifying": "Discovery",
    "Proposal Sent": "Proposal sent",
    "In Negotiation": "Negotiation",
    "Closed Won": "Closed",
    "Closed Lost": "Closed lost",
};

// Interaction types: one hue each, from the theme tokens. Text stays --foreground.
const LOG_TYPES: { key: string; label: string; plural: string; chip: string }[] = [
    { key: "Call", label: "Call", plural: "Calls", chip: "bg-stage-discovery/14 ring-stage-discovery/30" },
    { key: "Email", label: "Email", plural: "Emails", chip: "bg-stage-negotiation/14 ring-stage-negotiation/30" },
    { key: "Meeting", label: "Meeting", plural: "Meetings", chip: "bg-success/14 ring-success/30" },
    { key: "Note", label: "Note", plural: "Notes", chip: "bg-foreground/[0.06] ring-border" },
    { key: "outside_discussion", label: "Outside", plural: "Outside", chip: "bg-stage-new/12 ring-stage-new/30" },
    { key: "System", label: "System", plural: "System", chip: "bg-stage-proposal/12 ring-stage-proposal/30" },
];
const LOG_META = Object.fromEntries(LOG_TYPES.map((t) => [t.key, t]));

const day = (iso: string) => format(new Date(iso), "MMM d, yyyy");

function money(amount: number | null, currency: string | null) {
    if (!amount) return null;
    try {
        return new Intl.NumberFormat("en-PH", { style: "currency", currency: currency || "PHP", maximumFractionDigits: 0 }).format(amount);
    } catch {
        return amount.toLocaleString();
    }
}

export function ContactProfile({ data }: { data: ContactProfileData }) {
    const [filter, setFilter] = useState<string>("all");
    const type = TYPE_META[data.type];
    const latestProposal = data.proposals[0];
    const leadHref = `/dashboard/leads/${data.id}`;
    const isClosed = data.stage === "Closed Won" || data.stage === "Closed Lost";

    const counts = Object.fromEntries(LOG_TYPES.map((t) => [t.key, data.history.filter((h) => h.type === t.key).length]));
    const filters = [{ key: "all", label: "All", count: data.history.length }, ...LOG_TYPES.filter((t) => counts[t.key] > 0 || t.key !== "outside_discussion").map((t) => ({ key: t.key, label: t.plural, count: counts[t.key] }))];
    const rows = filter === "all" ? data.history : data.history.filter((h) => h.type === filter);

    const subline = [
        data.business,
        data.clientSince ? `client since ${format(new Date(data.clientSince), "MMM d, yyyy")}` : `added ${format(new Date(data.createdAt), "MMM d, yyyy")}`,
        data.lastContactAt ? `last interaction ${format(new Date(data.lastContactAt), "MMM d")}` : "not contacted yet",
    ]
        .filter(Boolean)
        .join(" · ");

    const facts: { label: string; value: React.ReactNode }[] = [
        {
            label: "Email",
            value: data.email ? (
                <a href={`mailto:${data.email}`} className="break-all underline-offset-4 hover:underline">{data.email}</a>
            ) : null,
        },
        {
            label: "Phone · preferred",
            value:
                data.phone || data.preferredContact ? (
                    <>
                        {data.phone ? <a href={`tel:${data.phone}`} className="tabular-nums underline-offset-4 hover:underline">{data.phone}</a> : "No phone"}
                        {data.preferredContact ? ` · ${data.preferredContact}` : ""}
                    </>
                ) : null,
        },
        { label: "Business", value: [data.business, data.industry].filter(Boolean).join(" · ") || null },
        { label: "Role in the company", value: data.role },
        { label: "Client type", value: data.clientType ? <span className="capitalize">{data.clientType}</span> : null },
        { label: "Source", value: `${data.source || "Website"} · ${day(data.createdAt)}` },
    ];

    return (
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
            {/* Header */}
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="min-w-[min(100%,22rem)] flex-1">
                    <Link
                        href="/dashboard/contacts"
                        className="group inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <ArrowLeft className="size-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" aria-hidden="true" />
                        Contacts
                    </Link>
                    <h1 className="mt-1 flex flex-wrap items-center gap-2.5 text-[28px] font-bold leading-tight tracking-[-0.025em] text-foreground">
                        {data.name}
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-normal text-foreground ring-1 ring-inset ${type.chip}`}>{type.label}</span>
                    </h1>
                    <p className="mt-1 text-base text-muted-foreground">{subline}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="h-10 gap-1.5 bg-card active:scale-[0.97]">
                        <Link href={leadHref}>
                            <ExternalLink className="size-4" aria-hidden="true" />
                            Open lead
                        </Link>
                    </Button>
                    {!isClosed && (
                        <Button asChild className="h-10 gap-1.5 font-semibold active:scale-[0.97]">
                            <Link href={`${leadHref}?log=1`}>
                                <MessageSquarePlus className="size-4" aria-hidden="true" />
                                Log interaction
                            </Link>
                        </Button>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                {/* Profile */}
                <section aria-labelledby="profile-heading" className="rounded-2xl bg-card p-5 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(0,0,0,0.03)]">
                    <h2 id="profile-heading" className="text-base font-semibold text-foreground">Profile</h2>
                    <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        {facts.map((fact) => (
                            <div key={fact.label} className="min-w-0">
                                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                                <dd className="mt-0.5 text-[15px] text-foreground">{fact.value || <span className="text-muted-foreground">Not given</span>}</dd>
                            </div>
                        ))}
                    </dl>

                    <h3 className="mt-5 border-t border-border pt-4 text-sm font-semibold text-foreground">Linked records</h3>
                    <ul className="mt-2 space-y-2 text-sm">
                        <li>
                            <span className="text-muted-foreground">Deal: </span>
                            <Link href={leadHref} className="text-foreground underline-offset-4 hover:underline">
                                {[data.service, STAGE_LABEL[data.stage] ?? data.stage].filter(Boolean).join(" · ")}
                            </Link>
                        </li>
                        <li>
                            <span className="text-muted-foreground">Proposal: </span>
                            {latestProposal ? (
                                <span className="text-foreground">
                                    v{latestProposal.version} {latestProposal.status.replace(/_/g, " ")}
                                    {latestProposal.signedAt
                                        ? ` ${format(new Date(latestProposal.signedAt), "MMM d")}`
                                        : latestProposal.sentAt
                                          ? ` ${format(new Date(latestProposal.sentAt), "MMM d")}`
                                          : ""}
                                    {money(latestProposal.totalPrice, latestProposal.currency) ? ` · ${money(latestProposal.totalPrice, latestProposal.currency)}` : ""}
                                </span>
                            ) : (
                                <span className="text-muted-foreground">None yet</span>
                            )}
                        </li>
                        <li>
                            <span className="text-muted-foreground">Project: </span>
                            {data.project ? (
                                <span className="text-foreground">
                                    {data.project.title} · {data.project.completedAt ? `completed ${format(new Date(data.project.completedAt), "MMM d")}` : `${data.project.status}, ${data.project.progress}%`}
                                </span>
                            ) : (
                                <span className="text-muted-foreground">None yet</span>
                            )}
                        </li>
                    </ul>
                </section>

                {/* Interaction history */}
                <section aria-labelledby="history-heading" className="overflow-hidden rounded-2xl bg-card shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(0,0,0,0.03)]">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
                        <h2 id="history-heading" className="text-base font-semibold text-foreground">Interaction history</h2>
                        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-1.5">
                            {filters.map((f) => {
                                const active = filter === f.key;
                                return (
                                    <button
                                        key={f.key}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => setFilter(f.key)}
                                        className={`h-8 rounded-full px-3 text-[13px] font-medium outline-none transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring ${
                                            active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/70"
                                        }`}
                                    >
                                        {f.label} <span className="tabular-nums opacity-70">{f.count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="override-scrollbar overflow-x-auto">
                        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-y border-border bg-muted text-xs text-muted-foreground">
                                    <th scope="col" className="w-[120px] px-5 py-2.5 font-medium">Date</th>
                                    <th scope="col" className="w-[100px] px-3 py-2.5 font-medium">Type</th>
                                    <th scope="col" className="px-3 py-2.5 font-medium">What happened</th>
                                    <th scope="col" className="w-[140px] px-5 py-2.5 font-medium">Logged by</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground">
                                            {data.history.length === 0 ? "No interactions logged yet." : "Nothing of this type yet."}
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((log) => {
                                        const meta = LOG_META[log.type] ?? LOG_META.Note;
                                        return (
                                            <tr key={log.id} className="border-b border-border/70 align-top last:border-b-0">
                                                <td className="whitespace-nowrap px-5 py-3 tabular-nums text-muted-foreground">{day(log.createdAt)}</td>
                                                <td className="px-3 py-3">
                                                    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold text-foreground ring-1 ring-inset ${meta.chip}`}>
                                                        {meta.label}
                                                    </span>
                                                </td>
                                                <td className="max-w-[65ch] whitespace-pre-wrap px-3 py-3 leading-relaxed text-foreground">{log.content}</td>
                                                <td className="px-5 py-3 text-muted-foreground">{log.type === "System" ? "Automatic" : log.by || "Unknown"}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}
