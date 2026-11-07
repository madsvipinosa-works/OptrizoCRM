"use client";

/**
 * Contacts table (Claude Design sample "SalesContacts"), one row per contact.
 * Kept to five columns (contact, type, email, status, last contact); the rest
 * is on the contact profile. Search, a type switch with counts, a service
 * filter, CSV export (all fields), sort by last contact and pagination.
 * A row opens the contact profile.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ContactRow = {
    id: string;
    name: string;
    business: string | null;
    role: string | null;
    email: string | null;
    phone: string | null;
    clientType: string | null;
    source: string | null;
    service: string | null;
    type: "lead" | "client" | "past_client";
    stage: string;
    projectStatus: string | null;
    completedAt: string | null;
    lastContactAt: string | null;
    lastContactType: string | null;
    logCount: number;
};

type TypeFilter = "all" | ContactRow["type"];

const TYPE_META: Record<ContactRow["type"], { label: string; chip: string }> = {
    lead: { label: "Lead", chip: "bg-stage-new/12 text-foreground ring-stage-new/30" },
    client: { label: "Client", chip: "bg-success/14 text-foreground ring-success/30" },
    past_client: { label: "Past client", chip: "bg-foreground/[0.06] text-foreground ring-border" },
};

const STAGE: Record<string, { label: string; dot: string }> = {
    "New Lead": { label: "New lead", dot: "bg-stage-new" },
    "Discovery & Qualifying": { label: "Discovery", dot: "bg-stage-discovery" },
    "Proposal Sent": { label: "Proposal sent", dot: "bg-stage-proposal" },
    "In Negotiation": { label: "Negotiation", dot: "bg-stage-negotiation" },
    "Closed Won": { label: "Closed", dot: "bg-stage-closed" },
    "Closed Lost": { label: "Closed lost", dot: "bg-destructive" },
};

const PAGE_SIZE = 10;
const STALE_DAYS = 5;

function statusOf(row: ContactRow, now: number) {
    if (row.type === "past_client" && row.completedAt) {
        return { label: `Completed ${format(new Date(row.completedAt), "MMM d")}`, dot: "bg-muted-foreground", stale: false };
    }
    if (row.type === "client") {
        return { label: row.projectStatus ? `Project · ${row.projectStatus}` : "Signed", dot: "bg-stage-closed", stale: false };
    }
    const stage = STAGE[row.stage] ?? { label: row.stage, dot: "bg-muted-foreground" };
    const open = row.stage !== "Closed Won" && row.stage !== "Closed Lost";
    const last = row.lastContactAt ? new Date(row.lastContactAt).getTime() : null;
    const stale = open && last !== null && now - last > STALE_DAYS * 24 * 60 * 60 * 1000;
    return { ...stage, stale };
}

function toCsv(rows: ContactRow[]) {
    const header = ["Name", "Business", "Role", "Type", "Email", "Phone", "Client type", "Source", "Service", "Stage", "Last contact", "Logs"];
    const escape = (value: string | number | null) => {
        const text = value === null || value === undefined ? "" : String(value);
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = rows.map((r) =>
        [
            r.name,
            r.business,
            r.role,
            TYPE_META[r.type].label,
            r.email,
            r.phone,
            r.clientType,
            r.source,
            r.service,
            STAGE[r.stage]?.label ?? r.stage,
            r.lastContactAt ? format(new Date(r.lastContactAt), "yyyy-MM-dd") : "",
            r.logCount,
        ]
            .map(escape)
            .join(",")
    );
    return [header.join(","), ...lines].join("\n");
}

export function ContactsTable({ rows }: { rows: ContactRow[] }) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [service, setService] = useState("all");
    const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
    const [page, setPage] = useState(1);
    // One clock per render pass, so "stale" is consistent across rows.
    const [now] = useState(() => Date.now());

    const counts = useMemo(
        () => ({
            all: rows.length,
            lead: rows.filter((r) => r.type === "lead").length,
            client: rows.filter((r) => r.type === "client").length,
            past_client: rows.filter((r) => r.type === "past_client").length,
        }),
        [rows]
    );

    const services = useMemo(
        () => Array.from(new Set(rows.map((r) => r.service).filter((s): s is string => Boolean(s)))).sort(),
        [rows]
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = rows.filter((r) => {
            if (typeFilter !== "all" && r.type !== typeFilter) return false;
            if (service !== "all" && r.service !== service) return false;
            if (!q) return true;
            return [r.name, r.business, r.email, r.phone].some((v) => v?.toLowerCase().includes(q));
        });
        const dir = sortDir === "desc" ? -1 : 1;
        return list.sort((a, b) => {
            // Never-contacted contacts sit at the end either way.
            if (!a.lastContactAt && !b.lastContactAt) return 0;
            if (!a.lastContactAt) return 1;
            if (!b.lastContactAt) return -1;
            return (new Date(a.lastContactAt).getTime() - new Date(b.lastContactAt).getTime()) * dir;
        });
    }, [rows, query, typeFilter, service, sortDir]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const current = Math.min(page, pageCount);
    const start = (current - 1) * PAGE_SIZE;
    const visible = filtered.slice(start, start + PAGE_SIZE);

    const resetPage = () => setPage(1);

    const exportCsv = () => {
        const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `contacts-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const typeOptions: { value: TypeFilter; label: string }[] = [
        { value: "all", label: "All" },
        { value: "lead", label: "Leads" },
        { value: "client", label: "Clients" },
        { value: "past_client", label: "Past clients" },
    ];

    return (
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 pb-12">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-[min(100%,22rem)] flex-1">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Contacts</h1>
                    <p className="mt-1 max-w-[72ch] text-sm text-muted-foreground">
                        Every lead and client in one list. Open a contact for their details and interaction history.
                    </p>
                </div>
                <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0} className="gap-1.5 bg-card active:scale-[0.97]">
                    <Download className="size-4" aria-hidden="true" />
                    Export CSV
                </Button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                        type="search"
                        aria-label="Search contacts"
                        placeholder="Search name, email or phone"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            resetPage();
                        }}
                        className="h-10 bg-card pl-9 pr-9"
                    />
                    {query && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => {
                                setQuery("");
                                resetPage();
                            }}
                            className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>

                <div role="group" aria-label="Contact type" className="inline-flex flex-wrap items-center rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/60">
                    {typeOptions.map((option) => {
                        const active = typeFilter === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                aria-pressed={active}
                                onClick={() => {
                                    setTypeFilter(option.value);
                                    resetPage();
                                }}
                                className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring ${
                                    active ? "bg-card text-foreground ring-1 ring-border/70" : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {option.label}
                                <span className="tabular-nums text-muted-foreground">{counts[option.value]}</span>
                            </button>
                        );
                    })}
                </div>

                <Select
                    value={service}
                    onValueChange={(value) => {
                        setService(value);
                        resetPage();
                    }}
                >
                    <SelectTrigger aria-label="Service" className="h-10 w-[200px] bg-card">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All services</SelectItem>
                        {services.map((s) => (
                            <SelectItem key={s} value={s}>
                                {s}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="override-scrollbar overflow-x-auto">
                    {/* Five columns: who, type, how to reach, where they are, when last contacted.
                        Phone, role, source, service and log counts live on the profile. */}
                    <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/40 text-left text-sm text-muted-foreground">
                                <th scope="col" className="sticky left-0 z-[1] bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))] px-5 py-2.5 font-medium shadow-[1px_0_0_var(--border)]">Contact</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Email</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                                <th scope="col" aria-sort={sortDir === "desc" ? "descending" : "ascending"} className="px-5 py-2.5 text-right font-medium">
                                    <button
                                        type="button"
                                        onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                                        className="-mr-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 font-medium text-foreground transition-colors hover:bg-background"
                                    >
                                        Last contact
                                        {sortDir === "desc" ? <ArrowDown className="size-3.5" aria-hidden="true" /> : <ArrowUp className="size-3.5" aria-hidden="true" />}
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-14 text-center">
                                        <p className="font-medium text-foreground">No contacts match</p>
                                        <p className="mt-1 text-muted-foreground">Try another search, type or service.</p>
                                    </td>
                                </tr>
                            ) : (
                                visible.map((row) => {
                                    const status = statusOf(row, now);
                                    const type = TYPE_META[row.type];
                                    const href = `/dashboard/contacts/${row.id}`;
                                    return (
                                        <tr
                                            key={row.id}
                                            onClick={() => router.push(href)}
                                            className="group cursor-pointer border-b border-border/70 transition-colors duration-150 last:border-b-0 hover:bg-muted"
                                        >
                                            {/* Name stays pinned while the table scrolls sideways on phones. */}
                                            <td className="sticky left-0 z-[1] max-w-[260px] bg-card px-5 py-3.5 shadow-[1px_0_0_var(--border)] transition-colors duration-150 group-hover:bg-muted">
                                                <Link
                                                    href={href}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="block truncate font-semibold text-foreground outline-none underline-offset-4 hover:underline focus-visible:underline"
                                                >
                                                    {row.name}
                                                </Link>
                                                <div className="truncate text-muted-foreground">{row.business || "No business name"}</div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${type.chip}`}>
                                                    {type.label}
                                                </span>
                                            </td>
                                            <td className="max-w-[260px] px-4 py-3.5">
                                                <div className="truncate text-foreground" title={row.email ?? undefined}>{row.email || "—"}</div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-foreground ${
                                                        status.stale ? "bg-warning/14" : "bg-foreground/[0.05]"
                                                    }`}
                                                >
                                                    <span className={`size-1.5 rounded-full ${status.stale ? "bg-warning" : status.dot}`} aria-hidden="true" />
                                                    {status.label}
                                                    {status.stale && " · Stale"}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                                                {row.lastContactAt ? format(new Date(row.lastContactAt), "MMM d") : "Not yet"}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
                    <span className="tabular-nums">
                        {filtered.length === 0
                            ? "No contacts"
                            : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length} · ${sortDir === "desc" ? "most recent" : "oldest"} contact first`}
                    </span>
                    <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)} className="h-8">
                            Previous
                        </Button>
                        {Array.from({ length: pageCount }, (_, i) => i + 1)
                            .filter((n) => n === 1 || n === pageCount || Math.abs(n - current) <= 1)
                            .map((n, i, list) => (
                                <span key={n} className="flex items-center gap-1.5">
                                    {i > 0 && n - list[i - 1] > 1 && <span aria-hidden="true">…</span>}
                                    <Button
                                        size="sm"
                                        variant={n === current ? "default" : "outline"}
                                        aria-current={n === current ? "page" : undefined}
                                        onClick={() => setPage(n)}
                                        className="h-8 min-w-8 px-2.5 tabular-nums"
                                    >
                                        {n}
                                    </Button>
                                </span>
                            ))}
                        <Button variant="outline" size="sm" disabled={current >= pageCount} onClick={() => setPage(current + 1)} className="h-8">
                            Next
                        </Button>
                    </div>
                </nav>
            </div>
        </div>
    );
}
