import Link from "next/link";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContentStatusButtons } from "@/features/cms/components/content/ContentStatusButtons";

export const dynamic = "force-dynamic";

const manilaDate = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

export default async function ServicesListPage() {
    const a = await requireRole("content_editor");
    if (!a.ok) notFound();

    const rows = await db.select().from(services).orderBy(asc(services.order), asc(services.title));
    const published = rows.filter((row) => row.status === "published").length;
    const draft = rows.filter((row) => row.status === "draft").length;
    const hidden = rows.filter((row) => row.status === "hidden").length;

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Services</h1>
                    <p className="text-muted-foreground">
                        {published} published, {draft} draft, {hidden} hidden. The same published list feeds the public
                        inquiry form.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/services/new">+ Add service</Link>
                </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3">Order</th>
                            <th className="px-4 py-3">Service</th>
                            <th className="px-4 py-3">Short description</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Updated</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.id} className="border-t border-border align-top">
                                <td className="px-4 py-3 font-mono">{row.order ?? 0}</td>
                                <td className="px-4 py-3 font-medium">{row.title}</td>
                                <td className="px-4 py-3 text-muted-foreground">{row.description}</td>
                                <td className="px-4 py-3">
                                    {row.isPreset ? <Badge variant="secondary">Preset</Badge> : <Badge variant="outline">Added</Badge>}
                                </td>
                                <td className="px-4 py-3">
                                    <Badge variant={row.status === "published" ? "default" : "outline"} className="capitalize">
                                        {row.status}
                                    </Badge>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{manilaDate.format(row.updatedAt)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-start justify-end gap-2">
                                        <Button asChild size="sm" variant="ghost">
                                            <Link href={`/dashboard/services/${row.id}`}>Edit</Link>
                                        </Button>
                                        <ContentStatusButtons kind="service" id={row.id} status={row.status} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {/* "Other" is not a database row: it is always the last option in the inquiry form. */}
                        <tr className="border-t border-border bg-muted/30">
                            <td className="px-4 py-3 text-muted-foreground">-</td>
                            <td className="px-4 py-3 font-medium">Other</td>
                            <td className="px-4 py-3 text-muted-foreground">Visitor types the service they need.</td>
                            <td className="px-4 py-3">
                                <Badge variant="outline">System</Badge>
                            </td>
                            <td className="px-4 py-3">
                                <Badge variant="outline">Always on</Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">-</td>
                            <td className="px-4 py-3 text-right text-xs text-muted-foreground">Fixed, always last</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-muted-foreground">
                Preset services can be edited or hidden, not deleted, so past leads keep their service. Published
                services appear on the Services page and in the inquiry form&apos;s Service list.
            </p>
        </div>
    );
}
