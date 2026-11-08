import { CmsPageHeader } from "@/features/cms/components/content/cms-ui";
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
        <div className="mx-auto w-full max-w-[1200px] space-y-6 pb-12">
            <CmsPageHeader title="Add a portfolio project" description="Only finished projects. Saved as a draft until you publish." back={{ href: "/dashboard/portfolio", label: "Back to portfolio" }} />
            <PortfolioEditorForm services={serviceOptions} />
        </div>
    );
}
