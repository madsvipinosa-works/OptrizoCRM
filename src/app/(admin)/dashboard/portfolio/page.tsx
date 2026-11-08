import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { caseStudies, services } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { Plus } from "lucide-react";
import { CmsPageHeader, sheet } from "@/features/cms/components/content/cms-ui";
import { Button } from "@/components/ui/button";
import { ContentStatusButtons, ContentStatusChip } from "@/features/cms/components/content/ContentStatusButtons";
import { DEFAULT_CLIENT_DISPLAY_NAME } from "@/features/cms/content/schemas";

export const dynamic = "force-dynamic";

export default async function PortfolioListPage() {
    const a = await requireRole("content_editor");
    if (!a.ok) notFound();

    const rows = await db
        .select({
            id: caseStudies.id,
            title: caseStudies.title,
            status: caseStudies.status,
            sortOrder: caseStudies.sortOrder,
            clientConsent: caseStudies.clientConsent,
            clientName: caseStudies.clientName,
            clientDisplayName: caseStudies.clientDisplayName,
            coverImage: caseStudies.coverImage,
            serviceTitle: services.title,
        })
        .from(caseStudies)
        .leftJoin(services, eq(caseStudies.serviceId, services.id))
        .orderBy(asc(caseStudies.sortOrder), asc(caseStudies.title));

    const published = rows.filter((r) => r.status === "published").length;

    // Mockup C5 content in the taste "framed sheet" look: peer cards, full-bleed cover, the title is the edit link.
    return (
        <div className="mx-auto w-full max-w-[1200px] space-y-6 pb-12">
            <CmsPageHeader
                title="Portfolio"
                description={`${published} of ${rows.length} on the website. Finished projects only; set the order inside each project.`}
                actions={
                    <Button asChild className="h-9 gap-1.5 font-semibold active:scale-[0.97]">
                        <Link href="/dashboard/portfolio/new">
                            <Plus className="size-4" aria-hidden="true" /> Add project
                        </Link>
                    </Button>
                }
            />

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => {
                    // Same rule as the public site: the real name only shows with the client's consent.
                    const shownAs =
                        row.clientConsent && row.clientName?.trim()
                            ? row.clientName
                            : row.clientDisplayName?.trim() || DEFAULT_CLIENT_DISPLAY_NAME;
                    return (
                        <li key={row.id} className={`${sheet} group relative flex flex-col overflow-hidden`}>
                            <div className="relative aspect-[16/10] shrink-0 overflow-hidden bg-muted">
                                {row.coverImage && (
                                    // eslint-disable-next-line @next/next/no-img-element -- private/proxied URLs, no next/image domain config
                                    <img
                                        src={row.coverImage}
                                        alt=""
                                        loading="lazy"
                                        className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                                    />
                                )}
                            </div>
                            <div className="flex flex-1 flex-col gap-1 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <h2 className="min-w-0 text-base font-semibold leading-snug text-foreground">
                                        {/* The title link covers the card, so the whole card opens the editor. */}
                                        <Link href={`/dashboard/portfolio/${row.id}`} className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring">
                                            {row.title}
                                        </Link>
                                    </h2>
                                    <ContentStatusChip status={row.status} />
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {shownAs} · {row.serviceTitle ?? "No service linked"}
                                </p>
                                <div className="relative z-10 mt-auto flex items-center justify-end gap-1 pt-2">
                                    <ContentStatusButtons kind="portfolio" id={row.id} status={row.status} />
                                </div>
                            </div>
                        </li>
                    );
                })}
                <li>
                    <Link
                        href="/dashboard/portfolio/new"
                        className="flex h-full min-h-56 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm font-medium text-muted-foreground outline-none transition-colors duration-150 ease-out hover:border-foreground/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <Plus className="size-5" aria-hidden="true" />
                        {rows.length === 0 ? "Add your first project" : "Add project"}
                    </Link>
                </li>
            </ul>
        </div>
    );
}
