import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { caseStudies, services } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContentStatusButtons } from "@/features/cms/components/content/ContentStatusButtons";
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
            serviceTitle: services.title,
        })
        .from(caseStudies)
        .leftJoin(services, eq(caseStudies.serviceId, services.id))
        .orderBy(asc(caseStudies.sortOrder), asc(caseStudies.title));

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Portfolio</h1>
                    <p className="text-muted-foreground">Finished projects shown on the website.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/portfolio/new">+ Add project</Link>
                </Button>
            </div>

            {rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No portfolio projects yet.
                </p>
            ) : (
                <ul className="grid gap-4 md:grid-cols-2">
                    {rows.map((row) => {
                        // Same rule as the public site: the real name only shows with the client's consent.
                        const shownAs =
                            row.clientConsent && row.clientName?.trim()
                                ? row.clientName
                                : row.clientDisplayName?.trim() || DEFAULT_CLIENT_DISPLAY_NAME;
                        return (
                            <li key={row.id} className="space-y-3 rounded-xl border border-border p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h2 className="truncate font-semibold">{row.title}</h2>
                                        <p className="text-sm text-muted-foreground">
                                            {shownAs} · {row.serviceTitle ?? "No service linked"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Order {row.sortOrder}</p>
                                    </div>
                                    <Badge variant={row.status === "published" ? "default" : "outline"} className="capitalize">
                                        {row.status}
                                    </Badge>
                                </div>
                                <div className="flex items-start justify-end gap-2">
                                    <Button asChild size="sm" variant="ghost">
                                        <Link href={`/dashboard/portfolio/${row.id}`}>Edit</Link>
                                    </Button>
                                    <ContentStatusButtons kind="portfolio" id={row.id} status={row.status} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
