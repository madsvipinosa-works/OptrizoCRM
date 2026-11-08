import { getPublishedPortfolio } from "@/features/cms/content/public-queries";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export const revalidate = 3600; // Cache and revalidate every hour (ISR)

export const metadata = {
    title: "Work",
    description: "Systems and sites we have shipped for Philippine teams.",
};

/**
 * Public portfolio, laid out like optrizo.com/work: a left-aligned intro, project cards
 * (cover, name, one line, arrow), then a closing call to action. Content comes from the
 * content editor's Portfolio (only published projects).
 */
export default async function ProjectsIndexPage() {
    const projects = await getPublishedPortfolio();

    return (
        <div className="relative min-h-screen overflow-hidden bg-background pb-24 pt-32 text-foreground">
            {/* Soft brand-green glow behind the intro, as on the About page. */}
            <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/4 -z-10 h-[420px] w-[620px] rounded-full bg-primary/10 blur-[120px]" />

            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
                <ScrollReveal className="max-w-2xl">
                    <p className="text-sm font-semibold text-brand-deep">Selected work</p>
                    <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                        Systems and sites shipping for Philippine teams
                    </h1>
                    <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                        From online stores to school enrollment and gym operations. Real brands, real workflows, honest outcomes.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link
                            href="/services"
                            className="group inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.97]"
                        >
                            Start a project
                            <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
                        </Link>
                        <Link
                            href="/services"
                            className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:border-foreground/20 active:scale-[0.97]"
                        >
                            Explore services
                        </Link>
                    </div>
                </ScrollReveal>

                {projects.length === 0 ? (
                    <p className="mt-16 rounded-2xl border border-border bg-card px-6 py-12 text-center text-muted-foreground">
                        New projects are on the way. Check back soon.
                    </p>
                ) : (
                    <ul className="mt-16 grid gap-6 md:grid-cols-2">
                        {projects.map((project, index) => (
                            <li key={project.id}>
                                <ScrollReveal delay={Math.min(index, 3) * 0.05} className="h-full">
                                    <Link
                                        href={`/projects/${project.slug}`}
                                        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card outline-none transition-colors duration-200 ease-out hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                                            {project.coverImage && (
                                                <Image
                                                    src={project.coverImage}
                                                    alt=""
                                                    fill
                                                    sizes="(min-width: 768px) 50vw, 100vw"
                                                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                                                />
                                            )}
                                        </div>
                                        <div className="flex flex-1 items-start justify-between gap-4 p-5">
                                            <div className="min-w-0">
                                                <h2 className="text-lg font-semibold tracking-tight text-foreground">{project.title}</h2>
                                                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                                    {project.summary || project.clientDisplayName}
                                                </p>
                                            </div>
                                            <span
                                                aria-hidden="true"
                                                className="grid size-10 shrink-0 place-items-center rounded-full border border-border text-foreground transition-colors duration-200 ease-out group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground"
                                            >
                                                <ArrowUpRight className="size-4" />
                                            </span>
                                        </div>
                                    </Link>
                                </ScrollReveal>
                            </li>
                        ))}
                    </ul>
                )}

                <ScrollReveal className="mt-24 flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-card p-8 sm:flex-row sm:items-center sm:p-10">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Have a project like these?</h2>
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
            </div>
        </div>
    );
}
