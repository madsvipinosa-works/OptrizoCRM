import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, caseStudies, services, users } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type Counts = { published: number; draft: number; hidden: number };

const manilaDateTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

const ACTION_LABELS: Record<string, string> = {
    CREATE: "Created draft",
    UPDATE: "Saved changes",
    PUBLISH: "Published",
    HIDE: "Hid",
    UNHIDE: "Unhid",
    RESTORE: "Restored",
};

const ROLE_LABELS: Record<string, string> = {
    content_editor: "Content Editor",
    superadmin: "Super Admin",
    manager: "Manager",
    sales: "Sales",
    developer: "Developer",
    client: "Client",
};

const PAGE_LABELS: Record<string, string> = { home: "Home page", about: "About page", contact: "Contact page" };

const RECENT_ENTITIES = ["Service", "Portfolio", "Page"];

/** The audit `details` column is text. Read only the fields we show, and never trust its shape. */
function readDetails(raw: string | null): { action: string | null; entityId: string | null; actorRole: string | null } {
    const empty = { action: null, entityId: null, actorRole: null };
    if (!raw) return empty;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return empty;
        const value = parsed as Record<string, unknown>;
        const text = (key: string) => (typeof value[key] === "string" ? (value[key] as string) : null);
        return { action: text("action"), entityId: text("entityId"), actorRole: text("actorRole") };
    } catch {
        return empty;
    }
}

function countByStatus(rows: { status: "draft" | "published" | "hidden"; n: number }[]): Counts {
    const counts: Counts = { published: 0, draft: 0, hidden: 0 };
    for (const row of rows) counts[row.status] = Number(row.n);
    return counts;
}

export default async function ContentHomePage() {
    const a = await requireRole("content_editor");
    if (!a.ok) notFound();

    const [serviceRows, portfolioRows, recent] = await Promise.all([
        db.select({ status: services.status, n: sql<number>`count(*)::int` }).from(services).groupBy(services.status),
        db
            .select({ status: caseStudies.status, n: sql<number>`count(*)::int` })
            .from(caseStudies)
            .groupBy(caseStudies.status),
        db
            .select({
                id: auditLogs.id,
                entity: auditLogs.entity,
                details: auditLogs.details,
                createdAt: auditLogs.createdAt,
                userName: users.name,
            })
            .from(auditLogs)
            .leftJoin(users, eq(auditLogs.userId, users.id))
            .where(inArray(auditLogs.entity, RECENT_ENTITIES))
            .orderBy(desc(auditLogs.createdAt))
            .limit(10),
    ]);

    const serviceCounts = countByStatus(serviceRows);
    const portfolioCounts = countByStatus(portfolioRows);

    const changes = recent.map((row) => ({ ...row, ...readDetails(row.details) }));

    // Record titles come from the live tables by id (read-only). A missing row means the record was removed.
    const serviceIds = changes.filter((c) => c.entity === "Service" && c.entityId).map((c) => c.entityId as string);
    const portfolioIds = changes.filter((c) => c.entity === "Portfolio" && c.entityId).map((c) => c.entityId as string);
    const [serviceTitles, portfolioTitles] = await Promise.all([
        serviceIds.length
            ? db.select({ id: services.id, title: services.title }).from(services).where(inArray(services.id, serviceIds))
            : Promise.resolve([] as { id: string; title: string }[]),
        portfolioIds.length
            ? db
                  .select({ id: caseStudies.id, title: caseStudies.title })
                  .from(caseStudies)
                  .where(inArray(caseStudies.id, portfolioIds))
            : Promise.resolve([] as { id: string; title: string }[]),
    ]);
    const titleOf = new Map<string, string>([
        ...serviceTitles.map((r) => [`Service:${r.id}`, r.title] as const),
        ...portfolioTitles.map((r) => [`Portfolio:${r.id}`, r.title] as const),
    ]);

    function recordLabel(entity: string, entityId: string | null): string {
        if (entity === "Page") return (entityId && PAGE_LABELS[entityId]) || "Page";
        if (!entityId) return "record removed";
        return titleOf.get(`${entity}:${entityId}`) ?? "record removed";
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Website content</h1>
                <p className="text-muted-foreground">What visitors see on the Optrizo website.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 rounded-xl border border-border p-5">
                    <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Services</p>
                    <p className="text-sm">
                        {serviceCounts.published} published · {serviceCounts.draft} draft · {serviceCounts.hidden} hidden
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Shown on the Services page and the inquiry form.
                    </p>
                    <Button asChild size="sm" variant="outline">
                        <Link href="/dashboard/services">Manage services</Link>
                    </Button>
                </div>
                <div className="space-y-2 rounded-xl border border-border p-5">
                    <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Portfolio</p>
                    <p className="text-sm">
                        {portfolioCounts.published} published · {portfolioCounts.draft} draft · {portfolioCounts.hidden} hidden
                    </p>
                    <p className="text-xs text-muted-foreground">Finished projects shown on the website.</p>
                    <Button asChild size="sm" variant="outline">
                        <Link href="/dashboard/portfolio">Manage portfolio</Link>
                    </Button>
                </div>
                <div className="space-y-2 rounded-xl border border-border p-5">
                    <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Pages</p>
                    <p className="text-sm">3 · Home, About, Contact</p>
                    <ul className="space-y-1 text-sm">
                        {(["home", "about", "contact"] as const).map((slug) => (
                            <li key={slug}>
                                <Link
                                    href={`/dashboard/pages/${slug}`}
                                    className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 hover:bg-accent"
                                >
                                    <span className="capitalize">{slug}</span>
                                    <span className="text-xs text-muted-foreground">Edit</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm">
                <p className="font-medium">How changes go live</p>
                <p className="mt-1 text-muted-foreground">
                    Edits are saved as drafts. Visitors see them only after you click Publish. This workspace edits
                    public website content only. It cannot open leads, proposals or projects.
                </p>
            </div>

            <div className="space-y-3">
                <h2 className="text-xl font-semibold">Recent changes</h2>
                {changes.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        No changes yet.
                    </p>
                ) : (
                    <ul className="divide-y divide-border rounded-xl border border-border">
                        {changes.map((change) => (
                            <li key={change.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 text-sm">
                                <span className="w-32 shrink-0 text-muted-foreground">
                                    {manilaDateTime.format(change.createdAt)}
                                </span>
                                <span className="font-medium">
                                    {change.userName ?? "Unknown user"}
                                    {change.actorRole && (
                                        <span className="ml-1 font-normal text-muted-foreground">
                                            ({ROLE_LABELS[change.actorRole] ?? change.actorRole})
                                        </span>
                                    )}
                                </span>
                                <span>{(change.action && ACTION_LABELS[change.action]) ?? "Changed"}</span>
                                <span className="text-muted-foreground">
                                    {change.entity}: {recordLabel(change.entity, change.entityId)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
