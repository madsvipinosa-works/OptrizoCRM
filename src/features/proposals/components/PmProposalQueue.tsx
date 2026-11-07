"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { claimOrAssignLeadPm, createDraftProposalForLead } from "@/features/proposals/actions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/datetime";

export interface ProposalQueueItem {
    id: string;
    businessName: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    urgency: string | null;
    proposalRequestedAt: Date | string | null;
    assignedPmId: string | null;
    assignedPm?: { id: string; name: string | null; email: string } | null;
    discoveryForm?: {
        goals: string;
        requiredFeatures: string;
        targetTimeline: string;
        budgetRange: string;
        clientType: "local" | "international";
        notes?: string | null;
    } | null;
    proposals?: Array<{
        id: string;
        status: string;
        version?: number | null;
        createdAt?: Date | string | null;
        updatedAt?: Date | string | null;
        sentAt?: Date | string | null;
    }>;
}

type QueueState = { label: string; tone: string; note: string };

const date = (d: Date | string | null | undefined) => (d ? formatDateTime(d) : "");

/** Row state from the latest version (mockup step 9): New request, Draft, Sent, Needs revision. */
function stateOf(lead: ProposalQueueItem): QueueState {
    const latest = [...(lead.proposals ?? [])].sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0];
    if (!latest) return { label: "New request", tone: "bg-destructive/10 text-destructive", note: `Requested by Sales · ${date(lead.proposalRequestedAt)}` };
    switch (latest.status) {
        case "draft":
            return { label: "Draft", tone: "bg-stage-negotiation/15 text-foreground", note: `Draft in progress · started ${date(latest.createdAt)}` };
        case "changes_requested":
            return { label: "Needs revision", tone: "bg-stage-negotiation/15 text-foreground", note: `Client asked for changes · ${date(latest.updatedAt)}` };
        case "pricing_meeting_requested":
            return { label: "Pricing meeting", tone: "bg-stage-discovery/15 text-foreground", note: `Client asked for a pricing meeting · ${date(latest.updatedAt)}` };
        default:
            return { label: "Sent", tone: "bg-stage-discovery/15 text-foreground", note: `Sent ${date(latest.sentAt ?? latest.updatedAt)}` };
    }
}

export function PmProposalQueue({ items, currentUserId }: { items: ProposalQueueItem[]; currentUserId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [selectedId, setSelectedId] = useState<string>(items[0]?.id || "");
    const selected = items.find((i) => i.id === selectedId) || items[0];

    const draft = selected?.proposals?.find((p) => p.status === "draft");
    const latest = selected ? [...(selected.proposals ?? [])].sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0] : undefined;

    const openOrDraft = (lead: ProposalQueueItem) => {
        startTransition(async () => {
            // Opening an unclaimed request claims it for this PM.
            if (!lead.assignedPmId) await claimOrAssignLeadPm(lead.id);
            const versions = [...(lead.proposals ?? [])].sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
            const existing = versions.find((p) => p.status === "draft");
            if (existing) {
                router.push(`/dashboard/proposals/builder/${existing.id}`);
                return;
            }
            // A sent version is revised on its own page, beside the negotiation thread (mockup 18d).
            if (versions[0]) {
                router.push(`/dashboard/proposals/${versions[0].id}`);
                return;
            }
            const res = await createDraftProposalForLead(lead.id);
            if (res.success && res.proposalId) router.push(`/dashboard/proposals/builder/${res.proposalId}`);
            else toast.error(res.message || "Could not start the proposal draft.");
        });
    };

    return (
        <section aria-labelledby="queue-heading" className="space-y-4">
            <div>
                <h2 id="queue-heading" className="text-lg font-semibold tracking-tight text-foreground">Proposal requests</h2>
                <p className="mt-1 text-sm text-muted-foreground">Every request arrives here with the full discovery notes attached.</p>
            </div>

            {items.length === 0 ? (
                <div className="rounded-xl border border-border bg-card px-5 py-10 text-center text-sm">
                    <p className="font-medium text-foreground">No open proposal requests.</p>
                    <p className="mt-1 text-muted-foreground">When Sales finishes discovery and asks for a proposal, it arrives here.</p>
                </div>
            ) : (
                <div className="grid items-start gap-5 lg:grid-cols-12">
                    <ul className="space-y-2 lg:col-span-5">
                        {items.map((lead) => {
                            const s = stateOf(lead);
                            const active = lead.id === selected?.id;
                            return (
                                <li key={lead.id}>
                                    <button
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => setSelectedId(lead.id)}
                                        className={cn(
                                            "flex w-full flex-col items-start gap-1.5 rounded-xl border bg-card p-4 text-left outline-none transition-[border-color,background-color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]",
                                            active ? "border-brand-deep/60 ring-1 ring-brand-deep/30" : "border-border hover:border-foreground/20"
                                        )}
                                    >
                                        {/* Full name, wrapped: never cut off or scrolled. */}
                                        <span className="w-full break-words font-semibold text-foreground">{lead.businessName || lead.contactName || "New lead"}</span>
                                        <span className="text-sm text-muted-foreground">{s.note}</span>
                                        <span className="flex w-full flex-wrap items-center justify-between gap-2">
                                            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", s.tone)}>{s.label}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {lead.assignedPmId === currentUserId ? "Yours" : lead.assignedPm ? lead.assignedPm.name || "Another PM" : "No PM yet"}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {selected && (
                        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 lg:col-span-7">
                            <h3 className="break-words text-base font-semibold text-foreground">
                                Business name: {selected.businessName || "Not given"} · Client name: {selected.contactName || "Not given"}
                            </h3>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                                <div className="col-span-2">
                                    <dt className="text-muted-foreground">Goals</dt>
                                    <dd className="mt-0.5 whitespace-pre-wrap text-base text-foreground">{selected.discoveryForm?.goals || "Not recorded"}</dd>
                                </div>
                                <div className="col-span-2">
                                    <dt className="text-muted-foreground">Required features</dt>
                                    <dd className="mt-0.5 whitespace-pre-wrap text-base text-foreground">{selected.discoveryForm?.requiredFeatures || "Not recorded"}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Timeline</dt>
                                    <dd className="mt-0.5 text-base text-foreground">{selected.discoveryForm?.targetTimeline || "Not recorded"}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Client budget range</dt>
                                    <dd className="mt-0.5 text-base tabular-nums text-foreground">{selected.discoveryForm?.budgetRange || "Not recorded"}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Client type</dt>
                                    <dd className="mt-0.5 text-base text-foreground">{selected.discoveryForm?.clientType === "international" ? "International" : "Local (Philippines)"}</dd>
                                </div>
                                {selected.discoveryForm?.notes && (
                                    <div className="col-span-2">
                                        <dt className="text-muted-foreground">Meeting notes</dt>
                                        <dd className="mt-0.5 whitespace-pre-wrap text-base text-foreground">{selected.discoveryForm.notes}</dd>
                                    </div>
                                )}
                            </dl>
                            <Button onClick={() => openOrDraft(selected)} disabled={isPending} className="mt-2 h-11 w-full gap-2 font-semibold active:scale-[0.97]">
                                {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                                {draft ? "Continue the draft" : !latest ? "Start drafting proposal" : latest.status === "changes_requested" ? "Revise the proposal" : "Open proposal"}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
