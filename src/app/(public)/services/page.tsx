import { getPublishedServices } from "@/features/cms/content/public-queries";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ServiceCardItem } from "@/components/public/ServiceCardItem";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export const revalidate = 3600; // Cache and revalidate every hour (ISR)

export const metadata = {
    title: "Services",
    description: "What Optrizo builds for Philippine teams, and how to request it.",
};

/**
 * Public Services page (mockups 1 and C4): a left-aligned intro like optrizo.com/services, then one
 * card per published service, the same card the content editor previews. Each card opens the inquiry form.
 */
export default async function ServicesPage() {
    const services = await getPublishedServices({ forInquiry: false });

    return (
        <div className="relative min-h-screen overflow-hidden bg-background pb-24 pt-32 text-foreground">
            {/* Soft brand-green glow behind the intro, as on About and Work. */}
            <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/4 -z-10 h-[420px] w-[620px] rounded-full bg-primary/10 blur-[120px]" />

            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
                <ScrollReveal className="max-w-2xl">
                    <p className="text-sm font-semibold text-brand-deep">Services</p>
                    <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                        Software that fits the way your team works
                    </h1>
                    <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                        Pick a service and send a short request. Every project starts with your workflow, and prices are agreed in the proposal.
                    </p>
                </ScrollReveal>

                {services.length === 0 ? (
                    <p className="mt-16 rounded-2xl border border-border bg-card px-6 py-12 text-center text-muted-foreground">
                        Services are being updated. Check back soon.
                    </p>
                ) : (
                    <div className="mt-16 grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {services.map((service) => (
                            <ServiceCardItem key={service.id} service={service} />
                        ))}
                    </div>
                )}

                <ScrollReveal className="mt-24 flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-card p-8 sm:flex-row sm:items-center sm:p-10">
                    <div>
                        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Not sure which service fits?</h2>
                        <p className="mt-2 text-muted-foreground">Tell us what you need. We reply within one business day.</p>
                    </div>
                    <Link
                        href="/contact"
                        className="group inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:border-foreground/20 active:scale-[0.97]"
                    >
                        Contact us
                        <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                </ScrollReveal>
            </div>
        </div>
    );
}
