import { getPublishedPortfolioBySlug, getPublishedServices } from "@/features/cms/content/public-queries";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { StartProjectCta } from "@/components/public/StartProjectCta";

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const project = await getPublishedPortfolioBySlug(decodeURIComponent(slug));
    if (!project) return { title: "Project not found" };
    return {
        title: project.title,
        description: project.summary || `Project for ${project.clientDisplayName}`,
    };
}

// The case-study HTML from the content editor. No typography plugin here, so it is styled directly (~75 characters per line).
const articleText =
    "max-w-xl text-base leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-brand-deep [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:mb-3 [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2:first-child]:mt-0 [&_h3]:mb-2 [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:mt-2 [&_li]:pl-1 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-4 [&_p:first-child]:mt-0 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-brand-deep";

/**
 * One portfolio project: everything the content editor collects (C6) is shown here:
 * title, summary, cover, client, service, technologies, live link, case study and gallery.
 */
export default async function ProjectDetailPage({ params }: Props) {
    const { slug } = await params;
    const project = await getPublishedPortfolioBySlug(decodeURIComponent(slug));
    if (!project) notFound();

    // Only a published service is named, so drafts never leak onto the public site.
    const service = project.serviceId ? (await getPublishedServices()).find((s) => s.id === project.serviceId) : undefined;
    const gallery = project.galleryImages.filter((url) => url && url !== project.coverImage);
    const details = [
        { label: "Client", value: project.clientDisplayName },
        ...(service ? [{ label: "Service", value: service.title }] : []),
        ...(project.publishedAt ? [{ label: "Published", value: new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(project.publishedAt) }] : []),
    ];

    return (
        <article className="mx-auto w-full max-w-6xl px-4 pb-24 pt-32 sm:px-6 lg:px-8">
            <Link
                href="/projects"
                className="group inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
                <ArrowLeft className="size-4 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" aria-hidden="true" />
                Back to work
            </Link>

            <ScrollReveal className="mt-8 max-w-3xl">
                <p className="text-sm font-semibold text-brand-deep">{service?.title ?? "Selected work"}</p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{project.title}</h1>
                {project.summary && <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{project.summary}</p>}
                {project.liveUrl && (
                    <a
                        href={project.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.97]"
                    >
                        Visit live site
                        <ArrowUpRight className="size-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                    </a>
                )}
            </ScrollReveal>

            {project.coverImage && (
                <div className="relative mt-12 aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-muted">
                    <Image src={project.coverImage} alt={`${project.title} cover`} fill priority sizes="(min-width: 1152px) 1152px, 100vw" className="object-cover" />
                </div>
            )}

            <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
                {project.content ? (
                    <div className={articleText} dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.content) }} />
                ) : (
                    <p className="max-w-xl text-muted-foreground">The full case study is coming soon.</p>
                )}

                <aside aria-label="Project details" className="lg:sticky lg:top-28 lg:self-start">
                    <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
                        {details.map((d) => (
                            <div key={d.label} className="px-5 py-4">
                                <dt className="text-sm text-muted-foreground">{d.label}</dt>
                                <dd className="mt-1 font-medium text-foreground">{d.value}</dd>
                            </div>
                        ))}
                        {project.technologies.length > 0 && (
                            <div className="px-5 py-4">
                                <dt className="text-sm text-muted-foreground">Built with</dt>
                                <dd className="mt-2 flex flex-wrap gap-1.5">
                                    {project.technologies.map((t) => (
                                        <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-sm text-foreground">{t}</span>
                                    ))}
                                </dd>
                            </div>
                        )}
                    </dl>
                </aside>
            </div>

            {gallery.length > 0 && (
                <section aria-labelledby="gallery-heading" className="mt-20">
                    <h2 id="gallery-heading" className="text-2xl font-semibold tracking-tight text-foreground">Gallery</h2>
                    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                        {gallery.map((url, i) => (
                            <li key={url} className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-muted">
                                <Image src={url} alt={`${project.title}, image ${i + 2}`} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <StartProjectCta className="mt-24" />
        </article>
    );
}
