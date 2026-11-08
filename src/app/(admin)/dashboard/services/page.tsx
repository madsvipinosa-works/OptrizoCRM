import Link from "next/link";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { Lock, Plus } from "lucide-react";
import { CmsPageHeader, sheet } from "@/features/cms/components/content/cms-ui";
import { Button } from "@/components/ui/button";
import { ContentStatusButtons, ContentStatusChip } from "@/features/cms/components/content/ContentStatusButtons";

export const dynamic = "force-dynamic";

const manilaDate = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

export default async function ServicesListPage() {
    const a = await requireRole("content_editor");
    if (!a.ok) notFound();

    const rows = await db.select().from(services).orderBy(asc(services.order), asc(services.title));
    const published = rows.filter((row) => row.status === "published").length;
    const draft = rows.filter((row) => row.status === "draft").length;
    const hidden = rows.filter((row) => row.status === "hidden").length;

    const th = "px-3 py-3 text-xs font-normal text-muted-foreground first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6";
    const td = "px-3 py-3.5 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6";

    // Mockup C2 content in the taste "framed sheet" look: no header band, the name carries its description,
    // one status pill, quiet row actions. Order is set in each service's editor (no reorder action yet).
    return (
        <div className="mx-auto w-full max-w-[1200px] space-y-6 pb-12">
            <CmsPageHeader
                title="Services"
                description={`${published} published · ${draft} draft${draft === 1 ? "" : "s"}${hidden ? ` · ${hidden} hidden` : ""}. The same list feeds the public inquiry form.`}
                actions={
                    <Button asChild className="h-9 gap-1.5 font-semibold active:scale-[0.97]">
                        <Link href="/dashboard/services/new">
                            <Plus className="size-4" aria-hidden="true" /> Add service
                        </Link>
                    </Button>
                }
            />

            <div className={`${sheet} overflow-x-auto`}>
                <table className="w-full min-w-[760px] text-sm">
                    <thead className="text-left">
                        <tr className="border-b border-border">
                            <th scope="col" className={`${th} w-10`}>#</th>
                            <th scope="col" className={th}>Service</th>
                            <th scope="col" className={th}>Status</th>
                            <th scope="col" className={`${th} text-right`}>Updated</th>
                            <th scope="col" className={`${th} w-40`}><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.id} className="border-b border-border/70 last:border-0">
                                <td className={`${td} tabular-nums text-muted-foreground`}>{row.order ?? 0}</td>
                                <td className={`${td} max-w-[28rem]`}>
                                    <Link
                                        href={`/dashboard/services/${row.id}`}
                                        className="rounded-sm font-medium text-foreground outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        {row.title}
                                    </Link>
                                    {row.isPreset && <span className="ml-2 text-sm text-muted-foreground">Preset</span>}
                                    <p className="mt-0.5 truncate text-muted-foreground" title={row.description}>{row.description}</p>
                                </td>
                                <td className={td}>
                                    <ContentStatusChip status={row.status} />
                                </td>
                                <td className={`${td} whitespace-nowrap text-right tabular-nums text-muted-foreground`}>{manilaDate.format(row.updatedAt)}</td>
                                <td className={td}>
                                    <div className="flex items-center justify-end gap-1">
                                        <Button asChild size="sm" variant="ghost" className="h-8 active:scale-[0.97]">
                                            <Link href={`/dashboard/services/${row.id}`}>Edit</Link>
                                        </Button>
                                        <ContentStatusButtons kind="service" id={row.id} status={row.status} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {/* "Other" is not a database row: it is always the last option in the inquiry form. */}
                        <tr>
                            <td className={`${td} text-muted-foreground`}>
                                <Lock className="size-3.5" aria-label="Fixed" />
                            </td>
                            <td className={td}>
                                <span className="font-medium text-foreground">Other</span>
                                <p className="mt-0.5 text-muted-foreground">Visitor types the service they need.</p>
                            </td>
                            <td className={td}>
                                <ContentStatusChip status="published" label="Always on" />
                            </td>
                            <td className={`${td} text-right text-muted-foreground`}>-</td>
                            <td className={`${td} text-right text-sm text-muted-foreground`}>Always last</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <p className="max-w-[75ch] text-sm text-muted-foreground">
                Set the order inside each service. Preset services can be edited or hidden, not deleted, so past leads keep their service.
            </p>
        </div>
    );
}
