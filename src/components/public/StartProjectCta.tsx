import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

/** Closing call to action on the Work pages (optrizo.com/work). The inquiry form lives on /services. */
export function StartProjectCta({ className = "" }: { className?: string }) {
    return (
        <ScrollReveal className={`flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-card p-8 sm:flex-row sm:items-center sm:p-10 ${className}`}>
            <div>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Have a project like these?</h2>
                <p className="mt-2 text-muted-foreground">Share a short brief. We reply within one business day.</p>
            </div>
            <Link
                href="/services"
                className="group inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.97]"
            >
                Start a project
                <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
        </ScrollReveal>
    );
}
