import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CmsPageHeader, sheet } from "@/features/cms/components/content/cms-ui";
import { notFound } from "next/navigation";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, caseStudies, services, users } from "@/db/schema";
import { requireRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

type Counts = { published: number; draft: number; hidden: number };

const manilaDateTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

// Recent changes read as sentences: "Claire Diaz published Service: Web Development".
const ACTION_LABELS: Record<string, string> = {
    CREATE: "created a draft of",
    UPDATE: "saved changes to",
    PUBLISH: "published",
    HIDE: "hid",
    UNHIDE: "showed again",
    RESTORE: "restored",
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

    const stats = [
        {
            label: "Services",
            count: serviceCounts.published,
            meta: `published · ${serviceCounts.draft} draft${serviceCounts.draft === 1 ? "" : "s"}`,
            note: "On the Services page and the inquiry form",
            href: "/dashboard/services",
            action: "Manage services",
        },
        {
            label: "Portfolio",
            count: portfolioCounts.published,
            meta: `published · ${portfolioCounts.hidden} hidden`,
            note: "Finished projects on the website",
            href: "/dashboard/portfolio",
            action: "Manage portfolio",
        },
        { label: "Pages", count: 3, meta: "fixed pages", note: "Home, About, Contact", href: "/dashboard/pages", action: "Edit pages" },
    ];

    // Mockup C1 content, taste "framed sheet" look: one divided strip of counts, then recent changes as sentences.
    return (
        <div className="mx-auto w-full max-w-[1200px] space-y-6 pb-12">
            <CmsPageHeader
                title="Website content"
                description="What visitors see on the Optrizo website."
            />

            <section aria-label="What is on the website" className={`${sheet} grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0`}>
                {stats.map((stat) => (
                    <div key={stat.label} className="flex flex-col p-5 sm:p-6">
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{stat.count}</span>
                            <span className="text-sm text-muted-foreground">{stat.meta}</span>
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{stat.note}</p>
                        <Link
                            href={stat.href}
                            className="group mt-4 inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-foreground outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {stat.action}
                            <ArrowRight className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
                        </Link>
                    </div>
                ))}
            </section>

            <section aria-labelledby="recent-heading" className={sheet}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 sm:px-6">
                    <h2 id="recent-heading" className="text-base font-semibold text-foreground">Recent changes</h2>
                    <p className="text-sm text-muted-foreground">Edits are drafts until you click Publish.</p>
                </div>
                {changes.length === 0 ? (
                    <p className="px-5 pb-6 pt-3 text-sm text-muted-foreground sm:px-6">No changes yet. Saved drafts and published edits show here.</p>
                ) : (
                    <ul className="mt-2 px-5 pb-2 sm:px-6">
                        {changes.map((change) => {
                            const name = change.userName ?? "Unknown user";
                            return (
                                <li key={change.id} className="flex items-center gap-3 border-t border-border/70 py-3 first:border-t-0">
                                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground">
                                        {name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                                    </span>
                                    <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                                        <span className="font-medium text-foreground">{name}</span>
                                        {change.actorRole && change.actorRole !== "content_editor" && <> ({ROLE_LABELS[change.actorRole] ?? change.actorRole})</>}{" "}
                                        {(change.action && ACTION_LABELS[change.action]) ?? "changed"}{" "}
                                        <span className="text-foreground">
                                            {change.entity}: {recordLabel(change.entity, change.entityId)}
                                        </span>
                                    </p>
                                    <time dateTime={change.createdAt.toISOString()} className="shrink-0 text-sm tabular-nums text-muted-foreground">
                                        {manilaDateTime.format(change.createdAt)}
                                    </time>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}
