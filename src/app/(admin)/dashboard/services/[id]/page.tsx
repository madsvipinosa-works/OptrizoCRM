import { CmsPageHeader } from "@/features/cms/components/content/cms-ui";
import { notFound } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { ServiceEditorForm } from "@/features/cms/components/content/ServiceEditorForm";

export const dynamic = "force-dynamic";

interface Props {
    params: Promise<{ id: string }>;
}

export default async function EditServicePage({ params }: Props) {
    const a = await requireRole("content_editor");
    if (!a.ok) notFound();

    const { id } = await params;
    const [service] = await db.select().from(services).where(eq(services.id, id)).limit(1);
    if (!service) notFound();

    // Live preview: the inquiry form's other published services, in website order.
    const inquiryList = (
        await db.select({ title: services.title }).from(services).where(and(eq(services.status, "published"), eq(services.showInInquiry, true), ne(services.id, id))).orderBy(asc(services.order), asc(services.title))
    ).map((r) => r.title);

    return (
        <div className="mx-auto w-full max-w-[1200px] space-y-6 pb-12">
            <CmsPageHeader title={service.title} description="Edit service" back={{ href: "/dashboard/services", label: "Back to services" }} />
            <ServiceEditorForm
                inquiryList={inquiryList}
                service={{
                    id: service.id,
                    title: service.title,
                    description: service.description,
                    inclusions: Array.isArray(service.inclusions) ? service.inclusions : [],
                    image: service.image,
                    showOnServicesPage: service.showOnServicesPage,
                    showInInquiry: service.showInInquiry,
                    order: service.order,
                    status: service.status,
                    isPreset: service.isPreset,
                }}
            />
        </div>
    );
}
