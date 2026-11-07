import Link from "next/link";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { PortfolioEditorForm } from "@/features/cms/components/content/PortfolioEditorForm";

export const dynamic = "force-dynamic";

export default async function NewPortfolioPage() {
    const a = await requireRole("content_editor");
    if (!a.ok) notFound();

    const serviceOptions = await db
        .select({ id: services.id, title: services.title, status: services.status })
        .from(services)
        .orderBy(asc(services.order), asc(services.title));

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <Link href="/dashboard/portfolio" className="text-sm text-muted-foreground hover:underline">
                    ← Back to portfolio
                </Link>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground mt-2">Add a portfolio project</h1>
                <p className="text-muted-foreground">Only finished projects. Nothing here links to the real project records.</p>
            </div>
            <PortfolioEditorForm services={serviceOptions} />
        </div>
    );
}
