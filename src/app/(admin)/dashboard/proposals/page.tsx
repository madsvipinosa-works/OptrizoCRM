import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { desc, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Lock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import { PmProposalQueue } from "@/features/proposals/components/PmProposalQueue";
import { getProposalRequestsQueue } from "@/features/proposals/actions";
import { formatDate } from "@/lib/datetime";

export const metadata = {
    title: "Proposals | Optrizo",
    description: "Every proposal for your leads, and every version the client received.",
};

export const dynamic = "force-dynamic";

/** Plain-language status (mockup 038). "tone" picks the chip colour from the Optrizo tokens. */
function statusOf(status: string, version: number, nextVersion: number | null) {
    switch (status) {
        case "draft":
            return { label: "Drafting by PM", tone: "muted" as const };
        case "sent":
            return { label: version > 1 ? "Revised, sent" : "Sent", tone: "info" as const };
        case "pricing_meeting_requested":
            return { label: "Pricing meeting", tone: "info" as const };
        case "changes_requested":
            return { label: "Changes requested", tone: "warn" as const };
        case "signed":
            return { label: "Signed", tone: "good" as const };
        case "declined":
            return { label: "Declined", tone: "bad" as const };
        case "replaced":
            return { label: nextVersion ? `Replaced by v${nextVersion}` : "Replaced", tone: "muted" as const };
        default:
            return { label: status.replace(/_/g, " "), tone: "muted" as const };
    }
}

const TONE = {
    muted: "bg-muted text-muted-foreground",
    info: "bg-stage-discovery/15 text-foreground",
    warn: "bg-stage-negotiation/15 text-foreground",
    good: "bg-brand-soft text-brand-deep",
    bad: "bg-destructive/10 text-destructive",
};

const STATUS_FILTERS = [
    { value: "", label: "All statuses" },
    { value: "draft", label: "Drafting by PM" },
    { value: "sent", label: "Sent" },
    { value: "pricing_meeting_requested", label: "Pricing meeting" },
    { value: "changes_requested", label: "Changes requested" },
    { value: "signed", label: "Signed" },
    { value: "declined", label: "Declined" },
    { value: "replaced", label: "Replaced" },
];

const money = (amount: number, currency: string) => (currency === "USD" ? `$${amount.toLocaleString("en-US")}` : `₱${amount.toLocaleString("en-PH")}`);

/** Proposals list (mockup 038). Sales: view only. PM: the same list plus the request queue and the editor link. */
export default async function ProposalsPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string }> }) {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");
    // Super Admin never opens proposals (spec section 6): only Sales and the PM.
    if (!hasRole(session, ["sales", "manager"])) redirect("/dashboard");

    const currentUserId = session.user.id;
    const isManager = hasRole(session, ["manager"]);
    const params = await searchParams;
    const q = (params?.q ?? "").trim().toLowerCase();
    const statusFilter = STATUS_FILTERS.some((s) => s.value === params?.status) ? params?.status ?? "" : "";

    const rows = await db.query.proposals.findMany({
        where: isNull(proposals.deletedAt),
        with: { lead: { with: { client: true, assignees: true } } },
        orderBy: [desc(proposals.createdAt)],
    });

    // Sales sees proposals for its own leads and unclaimed ones.
    const visible = isManager
        ? rows
        : rows.filter((p) => p.lead && (p.lead.assignees.length === 0 || p.lead.assignees.some((a) => a.userId === currentUserId)));

    const list = visible.filter((p) => {
        if (statusFilter && p.status !== statusFilter) return false;
        if (!q) return true;
        return [p.lead?.businessName, p.lead?.contactName, p.projectName, p.proposalCode].some((v) => v?.toLowerCase().includes(q));
    });

    const queueItems = isManager ? await getProposalRequestsQueue() : [];

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Proposals</h1>
                <p className="mt-1 text-sm text-muted-foreground">Every proposal for your leads, and every version the client received.</p>
            </div>

            {isManager ? (
                <PmProposalQueue items={queueItems} currentUserId={currentUserId} />
            ) : (
                <div className="flex items-start gap-3 rounded-xl border border-brand-deep/20 bg-brand-soft px-4 py-3 text-sm text-foreground">
                    <Lock className="mt-0.5 size-4 shrink-0 text-brand-deep" strokeWidth={1.75} aria-hidden="true" />
                    <p>
                        <span className="font-semibold">View only.</span> The Project Manager writes, prices and sends proposals. Use this to answer client
                        questions about scope, price or which version they have.
                    </p>
                </div>
            )}

            <AutoFilterForm className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input name="q" type="search" defaultValue={params?.q ?? ""} placeholder="Search business, project or no." aria-label="Search business, project or proposal number" className="h-10 bg-card pl-9" />
                </div>
                <select
                    name="status"
                    defaultValue={statusFilter}
                    aria-label="Filter by status"
                    className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {STATUS_FILTERS.map((s) => (
                        <option key={s.value} value={s.value}>
                            {s.label}
                        </option>
                    ))}
                </select>
                {(q || statusFilter) && (
                    <Link href="/dashboard/proposals" className="rounded-md px-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                        Clear
                    </Link>
                )}
            </AutoFilterForm>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                                <th scope="col" className="px-5 py-2.5 font-medium">Business name</th>
                                <th scope="col" className="px-3 py-2.5 font-medium">Project</th>
                                <th scope="col" className="px-3 py-2.5 font-medium">Version</th>
                                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                                <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Sent</th>
                                <th scope="col" className="px-3 py-2.5 font-medium">Price</th>
                                <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-14 text-center">
                                        <p className="font-medium text-foreground">{q || statusFilter ? "No proposals match." : "No proposals yet."}</p>
                                        <p className="mt-1 text-muted-foreground">
                                            {q || statusFilter ? "Clear the search or filter to see everything." : "A proposal appears here once the PM starts one for your lead."}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                list.map((p) => {
                                    const next = p.status === "replaced" ? visible.find((o) => o.leadId === p.leadId && o.version === p.version + 1)?.version ?? null : null;
                                    const s = statusOf(p.status, p.version, next);
                                    const isDraft = p.status === "draft";
                                    const amount = p.totalPrice ?? p.total ?? 0;
                                    const price = isDraft ? "–" : p.priceMode === "to_be_discussed" || !amount ? "To be discussed" : money(amount, p.currency);
                                    const name = p.lead?.businessName || p.lead?.client?.name || "Unnamed lead";
                                    return (
                                        <tr key={p.id} className="border-b border-border last:border-b-0">
                                            <td className="px-5 py-3">
                                                <p className="font-semibold text-foreground">{name}</p>
                                                {p.lead?.contactName && <p className="text-muted-foreground">{p.lead.contactName}</p>}
                                            </td>
                                            <td className="px-3 py-3">
                                                <p className="text-foreground">{p.projectName || "–"}</p>
                                                {/* The number the client sees on their copy ("Proposal no."); drafts have not reached the client yet. */}
                                                {!isDraft && p.proposalCode && <p className="text-xs tabular-nums text-muted-foreground">No. {p.proposalCode}</p>}
                                            </td>
                                            <td className="px-3 py-3 tabular-nums text-foreground">{isDraft ? "–" : `v${p.version}`}</td>
                                            <td className="px-3 py-3">
                                                <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[s.tone])}>{s.label}</span>
                                            </td>
                                            <td className="hidden px-3 py-3 tabular-nums text-muted-foreground md:table-cell">
                                                {p.sentAt ? formatDate(p.sentAt) : "Not sent yet"}
                                            </td>
                                            <td className="px-3 py-3 tabular-nums text-foreground">{price}</td>
                                            <td className="px-5 py-3">
                                                <div className="flex justify-end gap-2">
                                                    {isManager && (
                                                        <Button asChild variant="outline" size="sm">
                                                            <Link href={`/dashboard/proposals/builder/${p.id}`}>Edit<span className="sr-only"> proposal for {name}</span></Link>
                                                        </Button>
                                                    )}
                                                    {/* Sales cannot open a draft: it is not what the client received. */}
                                                    {isDraft && !isManager ? (
                                                        <span className="px-3 text-muted-foreground" aria-label="Not available yet">–</span>
                                                    ) : (
                                                        <Button asChild variant="outline" size="sm">
                                                            <Link href={`/dashboard/proposals/${p.id}`}>View<span className="sr-only"> proposal for {name}</span></Link>
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
