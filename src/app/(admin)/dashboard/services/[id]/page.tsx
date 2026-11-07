import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
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

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <Link href="/dashboard/services" className="text-sm text-muted-foreground hover:underline">
                    ← Back to services
                </Link>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground mt-2">Edit service</h1>
            </div>
            <ServiceEditorForm
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
