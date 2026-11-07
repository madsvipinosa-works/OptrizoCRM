import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatMonthYear } from "@/lib/datetime";

const money = (amount: number, currency: string) =>
    currency === "USD" ? `$${amount.toLocaleString("en-US")}` : `₱${amount.toLocaleString("en-PH")}`;

type Props = {
    proposalId: string;
    proposalCode: string;
    version: number;
    businessName: string;
    clientName: string;
    projectName: string | null;
    signedBy: string;
    signedAt: Date | string | null;
    online: boolean;
    total: number;
    currency: string;
    milestones: { startDate?: string | Date | null; endDate?: string | Date | null }[];
    firstPayment: { label: string; percent: number } | null;
    /** The project created when the proposal was signed. */
    projectId: string | null;
    /** Next steps are the PM's job; Sales sees the rest. */
    showNextSteps: boolean;
};

/**
 * What the PM sees once a proposal is signed (mockup 20b): the locked proposal, the next steps,
 * and what the system did on its own. Read-only; the steps link into the project.
 */
export function SignedProposalSummary(p: Props) {
    const dates = p.milestones.flatMap((m) => [m.startDate, m.endDate]).filter(Boolean).map((d) => new Date(d as string | Date));
    const first = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
    const last = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
    const timeline = first && last ? `${formatMonthYear(first)} – ${formatMonthYear(last)} · ${p.milestones.length} milestones` : `${p.milestones.length} milestones`;
    const paymentAmount = p.firstPayment ? Math.round((p.total * p.firstPayment.percent) / 100) : null;
    const projectHref = p.projectId ? `/dashboard/pm/${p.projectId}` : "/dashboard/pm";

    const rows: [string, string, boolean?][] = [
        ["Proposal", `${p.proposalCode} · v${p.version}`],
        ["Signed by", `${p.signedBy}, ${p.businessName}`],
        ["Date and time", p.signedAt ? formatDateTime(p.signedAt) : "-"],
        ["Method", p.online ? "Online, in the client portal" : "On paper, uploaded by the PM"],
        ["Total price", money(p.total, p.currency), true],
        ["Timeline", timeline],
    ];

    const done = [
        ["Proposal locked", `v${p.version} is now the signed version. Later changes go through change requests.`],
        ["Lead closed as Won", "The lead moved to Closed · Signed on the Sales pipeline. Sales was notified."],
        ["Client account upgraded", `${p.clientName} is now a Client. The portal shows the project and its progress.`],
        ["Project created", `${p.projectName || "The project"}, with the 5 fixed milestones and dates from the proposal.`],
        [
            "Payment schedule created",
            p.firstPayment && paymentAmount !== null
                ? `${p.firstPayment.label} (${p.firstPayment.percent}%, ${money(paymentAmount, p.currency)}) is due now. The client got the payment details by email.`
                : "The payment schedule from the proposal is in place. The client got the payment details by email.",
        ],
        ["Signed copy saved", "PDF stored in Documents for you and the client. Logged in Activity."],
    ];

    const chips = ["Draft", "Sent v1", ...(p.version > 1 ? [`Revised v${p.version}`] : []), "Signed"];

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-deep/30 bg-[var(--brand-soft)] px-4 py-3 text-sm text-[var(--brand-deep)]">
                <p>
                    <span className="font-semibold">Proposal signed:</span> {p.businessName} accepted and signed proposal v{p.version}.
                </p>
                {p.signedAt && <span className="text-muted-foreground">Notification · {formatDateTime(p.signedAt)}</span>}
            </div>

            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div>
                    <p className="text-sm text-muted-foreground">
                        {p.businessName} · {p.clientName}
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{p.projectName || p.proposalCode}</h1>
                </div>
                <ol className="flex flex-wrap items-center gap-2 text-sm font-medium" aria-label="Proposal history">
                    {chips.map((c, i) => (
                        <li key={c} className="flex items-center gap-2">
                            {i > 0 && <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                            <span
                                className={cn(
                                    "rounded-full px-3 py-1",
                                    i === chips.length - 1 ? "bg-[var(--brand-deep)] text-white" : "bg-[var(--brand-soft)] text-[var(--brand-deep)]"
                                )}
                            >
                                {c}
                            </span>
                        </li>
                    ))}
                </ol>
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-2">
                <div className="space-y-5">
                    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="signed-heading">
                        <div className="flex items-center justify-between gap-3">
                            <h2 id="signed-heading" className="text-lg font-semibold tracking-tight text-foreground">
                                Signed proposal
                            </h2>
                            <span className="rounded-full bg-[var(--brand-soft)] px-3 py-0.5 text-sm font-medium text-[var(--brand-deep)]">Signed · locked</span>
                        </div>
                        <dl className="mt-2 divide-y divide-border text-sm">
                            {rows.map(([k, v, strong]) => (
                                <div key={k} className="flex items-center justify-between gap-4 py-2.5">
                                    <dt className="text-muted-foreground">{k}</dt>
                                    <dd className={cn("text-right text-foreground", strong && "font-semibold")}>{v}</dd>
                                </div>
                            ))}
                        </dl>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <Button asChild variant="outline" className="h-10 rounded-lg">
                                <a href={`/api/proposals/${p.proposalId}/pdf`} target="_blank" rel="noreferrer">View signed PDF</a>
                            </Button>
                            <Button asChild variant="outline" className="h-10 rounded-lg">
                                <a href={`/api/proposals/${p.proposalId}/pdf`} download>Download</a>
                            </Button>
                        </div>
                    </section>

                    {p.showNextSteps && <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="next-heading">
                        <h2 id="next-heading" className="text-lg font-semibold tracking-tight text-foreground">
                            Your next steps
                        </h2>
                        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-foreground">
                            <li>Set the project team (developers).</li>
                            <li>Add the first Requirements tasks and assign them.</li>
                            <li>Confirm payment 1 once the client pays.</li>
                        </ol>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <Button asChild className="h-10 flex-1 rounded-lg font-semibold">
                                <Link href={projectHref}>Open project</Link>
                            </Button>
                            <Button asChild variant="outline" className="h-10 rounded-lg">
                                <Link href={p.projectId ? `${projectHref}?team=1` : projectHref}>Set up team</Link>
                            </Button>
                        </div>
                    </section>}
                </div>

                <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="auto-heading">
                    <h2 id="auto-heading" className="text-lg font-semibold tracking-tight text-foreground">
                        What the system did automatically
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">All of this happened the moment the client signed. Nothing to do by hand.</p>
                    <ul className="mt-3 divide-y divide-border">
                        {done.map(([title, detail]) => (
                            <li key={title} className="flex gap-3 py-3">
                                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-deep)]">
                                    <Check className="size-3.5" aria-hidden="true" />
                                </span>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">{title}</p>
                                    <p className="text-sm text-muted-foreground">{detail}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}
