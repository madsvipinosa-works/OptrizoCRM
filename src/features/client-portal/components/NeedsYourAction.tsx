import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatWithZone } from "@/lib/datetime";
import { meetingTypeLabel } from "@/lib/email-templates";

const day = (d: Date | string) => new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
const money = (amount: number, currency: string) => (currency === "PHP" ? `₱${amount.toLocaleString("en-PH")}` : `${currency} ${amount.toLocaleString("en-PH")}`);

type Item = { key: string; title: string; detail: string; href: string; action: string; tone: "primary" | "warn" | "link" };

/**
 * Portal home "Needs your action" (mockup 089): one card for everything waiting on the client,
 * a proposal to sign, a meeting to confirm, a payment due, and files Optrizo shared. Hidden when nothing waits.
 */
export function NeedsYourAction({
    proposals,
    meetings,
    timezone,
    payments,
    files,
}: {
    proposals: { id: string; title: string; status: string; validUntil: Date | null }[];
    meetings: { id: string; type: "discovery" | "budget_pricing" | "project_review" | "uat"; status: string; startsAt: Date }[];
    /** The client's saved timezone, so meeting times read in their own time. */
    timezone: string | null;
    payments: { id: string; projectId: string; label: string; amount: number; currency: string; status: string; dueDate: Date | null; project?: { title: string } | null }[];
    files: { id: string; title: string; projectId: string; createdAt: Date }[];
}) {
    const items: Item[] = [
        // Only "sent" waits on the client; the other open statuses wait on the PM.
        ...proposals
            .filter((p) => p.status === "sent")
            .map((p) => ({
                key: `p-${p.id}`,
                title: `Proposal: ${p.title}`,
                detail: p.validUntil ? `Review and sign by ${day(p.validUntil)}` : "Review and sign",
                href: `/proposal/${p.id}`,
                action: "Sign now",
                tone: "primary" as const,
            })),
        // A meeting waits on the client to confirm; a confirmed one in the next 2 days is a heads-up.
        ...meetings.map((m) => ({
            key: `m-${m.id}`,
            title: m.status === "awaiting_client" ? `Confirm your ${meetingTypeLabel(m.type)}` : `Coming up: ${meetingTypeLabel(m.type)}`,
            detail: formatWithZone(m.startsAt, timezone),
            href: "/portal/appointments",
            action: m.status === "awaiting_client" ? "Respond" : "View",
            tone: m.status === "awaiting_client" ? ("primary" as const) : ("link" as const),
        })),
        ...payments.map((p) => ({
            key: `pay-${p.id}`,
            title: p.status === "proof_uploaded" ? `Payment proof sent: ${money(p.amount, p.currency)}` : `Payment due: ${money(p.amount, p.currency)}`,
            detail:
                p.status === "proof_uploaded"
                    ? `${p.project?.title ?? p.label} · waiting for Optrizo to confirm`
                    : `${p.project?.title ?? p.label}${p.dueDate ? ` · pay by ${day(p.dueDate)}` : ""}`,
            href: `/portal/projects/${p.projectId}/payments`,
            action: "View payments",
            tone: "warn" as const,
        })),
        ...files.map((f) => ({
            key: `f-${f.id}`,
            title: f.title,
            detail: `Uploaded ${day(f.createdAt)}`,
            href: "/portal/documents",
            action: "View",
            tone: "link" as const,
        })),
    ];

    if (items.length === 0) return null;

    return (
        <section aria-labelledby="action-heading" className="max-w-2xl rounded-xl border-2 border-brand-deep/60 bg-card p-5 sm:p-6">
            <h2 id="action-heading" className="text-lg font-semibold tracking-tight text-foreground">
                Needs your action
            </h2>
            <ul className="mt-3 divide-y divide-border">
                {items.map((item) => (
                    <li key={item.key} className="flex items-center justify-between gap-4 py-3 last:pb-0">
                        <div className="min-w-0">
                            <p className="text-base text-foreground">{item.title}</p>
                            <p className="text-sm text-muted-foreground">{item.detail}</p>
                        </div>
                        <Link
                            href={item.href}
                            className={cn(
                                "shrink-0 rounded-full px-3 py-1 text-sm font-semibold outline-none transition-[opacity,transform] duration-150 ease-out hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
                                item.tone === "primary" && "bg-primary text-primary-foreground",
                                item.tone === "warn" && "bg-stage-negotiation/15 text-foreground",
                                item.tone === "link" && "px-0 text-brand-deep hover:underline"
                            )}
                        >
                            {item.action}
                            <span className="sr-only">: {item.title}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
