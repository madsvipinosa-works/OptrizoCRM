import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CmsPageHeader } from "@/features/cms/components/content/cms-ui";
import { PageTabs } from "@/features/cms/components/content/PageTabs";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { caseStudies, pageVersions, services, users } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { getPageForEdit } from "@/features/cms/content/pages.actions";
import { pageSlugSchema, PAGE_SLUGS } from "@/features/cms/content/schemas";
import { PageEditor } from "@/features/cms/components/content/PageEditor";
import type { FeatureOption } from "@/features/cms/components/content/PageFields";
import { VersionHistory, type VersionItem } from "@/features/cms/components/content/VersionHistory";

export const dynamic = "force-dynamic";

const MAX_VERSIONS = 50;
const TAB_LABELS = { home: "Home", about: "About", contact: "Contact" } as const;

interface Props {
    params: Promise<{ slug: string }>;
}

function featureOptions(
    rows: { id: string; title: string; status: "draft" | "published" | "hidden" }[],
    selected: string[],
): FeatureOption[] {
    // Published items, plus anything already featured that is no longer published (so it can be unticked).
    return rows
        .filter((row) => row.status === "published" || selected.includes(row.id))
        .map((row) => ({ id: row.id, title: row.title, published: row.status === "published" }));
}

function idList(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export default async function PageEditorPage({ params }: Props) {
    const a = await requireRole("content_editor");
    if (!a.ok) notFound();

    const { slug: rawSlug } = await params;
    const parsedSlug = pageSlugSchema.safeParse(rawSlug);
    if (!parsedSlug.success) notFound();
    const slug = parsedSlug.data;

    const loaded = await getPageForEdit(slug);
    if (!loaded.ok) notFound();
    const page = loaded.page;

    const initialFields = page.draftFields ?? page.fields;

    const [serviceRows, portfolioRows, versionRows, publisher] = await Promise.all([
        db
            .select({ id: services.id, title: services.title, status: services.status })
            .from(services)
            .orderBy(asc(services.order), asc(services.title)),
        db
            .select({ id: caseStudies.id, title: caseStudies.title, status: caseStudies.status })
            .from(caseStudies)
            .orderBy(asc(caseStudies.sortOrder), asc(caseStudies.title)),
        db
            .select({
                versionNo: pageVersions.versionNo,
                action: pageVersions.action,
                restoredFrom: pageVersions.restoredFrom,
                createdAt: pageVersions.createdAt,
                fields: pageVersions.fields,
                authorName: users.name,
            })
            .from(pageVersions)
            .leftJoin(users, eq(pageVersions.createdBy, users.id))
            .where(eq(pageVersions.pageSlug, slug))
            .orderBy(desc(pageVersions.versionNo))
            .limit(MAX_VERSIONS),
        page.publishedBy
            ? db.select({ name: users.name }).from(users).where(eq(users.id, page.publishedBy)).limit(1)
            : Promise.resolve([] as { name: string | null }[]),
    ]);

    const titles: Record<string, string> = {};
    for (const row of [...serviceRows, ...portfolioRows]) titles[row.id] = row.title;

    const versions: VersionItem[] = versionRows.map((row) => ({
        versionNo: row.versionNo,
        action: row.action === "restore" ? "restore" : "publish",
        restoredFrom: row.restoredFrom,
        authorName: row.authorName,
        createdAt: row.createdAt.toISOString(),
        fields: row.fields,
    }));

    return (
        <div className="mx-auto w-full max-w-[1200px] space-y-6 pb-12">
            <div className="space-y-5">
                <CmsPageHeader
                    title="Pages"
                    description="Fixed pages. You edit the text and details, not the layout."
                    actions={
                        <Button asChild variant="outline" className="h-9 gap-1.5 bg-card active:scale-[0.97]">
                            <a href={slug === "home" ? "/" : `/${slug}`} target="_blank" rel="noopener noreferrer">
                                View live page <ArrowUpRight className="size-4" aria-hidden="true" />
                            </a>
                        </Button>
                    }
                />
                <PageTabs tabs={PAGE_SLUGS.map((tab) => ({ slug: tab, label: TAB_LABELS[tab] }))} active={slug} />
            </div>

            <PageEditor
                key={`${slug}-${page.version}-${page.draftUpdatedAt?.toISOString() ?? "none"}`}
                slug={slug}
                version={page.version}
                hasDraft={page.draftFields !== null}
                initialFields={initialFields}
                publishedAt={page.publishedAt ? page.publishedAt.toISOString() : null}
                publishedByName={publisher[0]?.name ?? null}
                services={featureOptions(serviceRows, idList(initialFields.featuredServiceIds))}
                portfolio={featureOptions(portfolioRows, idList(initialFields.featuredPortfolioIds))}
                titles={titles}
            />

            <VersionHistory
                key={`versions-${slug}-${page.version}-${page.draftFields !== null}`}
                slug={slug}
                currentVersion={page.version}
                hasDraft={page.draftFields !== null}
                versions={versions}
                titles={titles}
            />
        </div>
    );
}
