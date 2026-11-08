import { CmsPageHeader } from "@/features/cms/components/content/cms-ui";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { ServiceEditorForm } from "@/features/cms/components/content/ServiceEditorForm";

export const dynamic = "force-dynamic";

export default async function NewServicePage() {
    const a = await requireRole("content_editor");
    if (!a.ok) notFound();

    // Live preview: the inquiry form's other published services, in website order.
    const inquiryList = (
        await db.select({ title: services.title }).from(services).where(and(eq(services.status, "published"), eq(services.showInInquiry, true))).orderBy(asc(services.order), asc(services.title))
    ).map((r) => r.title);

    return (
        <div className="mx-auto w-full max-w-[1200px] space-y-6 pb-12">
            <CmsPageHeader title="Add a service" description="Saved as a draft. Visitors see it only after you publish." back={{ href: "/dashboard/services", label: "Back to services" }} />
            <ServiceEditorForm inquiryList={inquiryList} />
        </div>
    );
}
