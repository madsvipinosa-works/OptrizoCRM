import { CmsPageHeader } from "@/features/cms/components/content/cms-ui";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { caseStudies, services } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { PortfolioEditorForm } from "@/features/cms/components/content/PortfolioEditorForm";

export const dynamic = "force-dynamic";

interface Props {
    params: Promise<{ id: string }>;
}

export default async function EditPortfolioPage({ params }: Props) {
    const a = await requireRole("content_editor");
    if (!a.ok) notFound();

    const { id } = await params;
    const [project] = await db.select().from(caseStudies).where(eq(caseStudies.id, id)).limit(1);
    if (!project) notFound();

    const serviceOptions = await db
        .select({ id: services.id, title: services.title, status: services.status })
        .from(services)
        .orderBy(asc(services.order), asc(services.title));

    const gallery = Array.isArray(project.galleryImages) ? project.galleryImages : [];
    const images = [project.coverImage, ...gallery].filter(
        (url, index, all): url is string => !!url && all.indexOf(url) === index,
    );

    return (
        <div className="mx-auto w-full max-w-[1200px] space-y-6 pb-12">
            <CmsPageHeader title={project.title} description="Edit portfolio project" back={{ href: "/dashboard/portfolio", label: "Back to portfolio" }} />
            <PortfolioEditorForm
                services={serviceOptions}
                project={{
                    id: project.id,
                    title: project.title,
                    serviceId: project.serviceId,
                    summary: project.summary ?? project.description ?? "",
                    images,
                    technologies: Array.isArray(project.technologies) ? project.technologies : [],
                    liveUrl: project.liveUrl,
                    clientName: project.clientName,
                    clientDisplayName: project.clientDisplayName,
                    clientConsent: project.clientConsent,
                    sortOrder: project.sortOrder,
                    status: project.status,
                }}
            />
        </div>
    );
}
