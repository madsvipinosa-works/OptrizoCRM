import Link from "next/link";
import { ArrowRight, Check, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { REQUEST_STEPS, type getClientRequests } from "@/features/client-portal/queries";

type Request = Awaited<ReturnType<typeof getClientRequests>>[number];

const when = (d: Date) => d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });

/** Numbered stepper from request to customer: done steps get a check, the current one a ring. */
function Stepper({ step }: { step: number }) {
    return (
        <ol className="flex" aria-label={`Progress: ${REQUEST_STEPS[step]}`}>
            {REQUEST_STEPS.map((label, i) => (
                <li key={label} className="relative flex flex-1 flex-col items-center text-center">
                    {i > 0 && (
                        <span
                            aria-hidden="true"
                            className={cn("absolute right-1/2 top-[18px] h-0.5 w-full -translate-y-1/2", i <= step ? "bg-brand-deep" : "bg-border")}
                        />
                    )}
                    <span
                        aria-hidden="true"
                        className={cn(
                            "relative z-10 flex size-9 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                            i < step && "bg-brand-deep text-background",
                            i === step && "bg-brand-deep text-background ring-4 ring-brand-soft",
                            i > step && "border-2 border-border bg-card text-muted-foreground"
                        )}
                    >
                        {i < step ? <Check className="size-4" strokeWidth={2.5} /> : i + 1}
                    </span>
                    <span className={cn("mt-2 px-1 text-xs leading-tight sm:text-sm", i === step ? "font-semibold text-brand-deep" : i < step ? "text-foreground" : "text-muted-foreground")}>
                        {label}
                    </span>
                    <span className="sr-only">{i < step ? "done" : i === step ? "current step" : "not yet"}</span>
                </li>
            ))}
        </ol>
    );
}

/**
 * Portal home: open requests with a large progress stepper (request to customer) and their latest updates.
 * Once the client signs, a request becomes a short "Availed" line that links to the project, whose
 * milestone progress (mockup 29) takes over.
 */
export function ClientRequests({ requests }: { requests: Request[] }) {
    const open = requests.filter((r) => !r.availed && !r.closed);
    const availed = requests.filter((r) => r.availed);
    if (open.length === 0 && availed.length === 0) return null;

    return (
        <section aria-labelledby="requests-heading" className="space-y-3">
            <h2 id="requests-heading" className="text-lg font-semibold tracking-tight text-foreground">
                Your requests
            </h2>

            {open.map((r) => (
                <article key={r.id} className="rounded-xl border border-border bg-card p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-base font-semibold text-foreground sm:text-lg">{r.service}</h3>
                            {r.business && <p className="text-sm text-muted-foreground">{r.business}</p>}
                        </div>
                        {r.waitingProposalId ? (
                            <Button asChild>
                                <Link href={`/proposal/${r.waitingProposalId}`}>
                                    Review proposal <ArrowRight className="size-4" aria-hidden="true" />
                                </Link>
                            </Button>
                        ) : (
                            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">In review</span>
                        )}
                    </div>

                    <div className="mt-6">
                        <Stepper step={r.step} />
                    </div>

                    <ul className="mt-6 space-y-1.5 border-t border-border pt-4">
                        {r.events.map((e, i) => (
                            <li key={i} className="flex items-baseline justify-between gap-4 text-sm">
                                <span className={i === 0 ? "text-foreground" : "text-muted-foreground"}>{e.text}</span>
                                <time dateTime={e.at.toISOString()} className="shrink-0 tabular-nums text-muted-foreground">
                                    {when(e.at)}
                                </time>
                            </li>
                        ))}
                    </ul>
                </article>
            ))}

            {availed.length > 0 && (
                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                    {availed.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                            <div className="flex min-w-0 items-center gap-2.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-deep">
                                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                    Availed
                                </span>
                                <span className="truncate text-sm font-medium text-foreground">{r.service}</span>
                            </div>
                            {r.projectId ? (
                                <Link href={`/portal/projects/${r.projectId}`} className="text-sm font-medium text-brand-deep outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                                    View project progress<span className="sr-only"> for {r.service}</span>
                                </Link>
                            ) : (
                                <span className="text-sm text-muted-foreground">Project being set up</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
