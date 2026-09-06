import { db } from "@/db";
import { caseStudies } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Gallery4, type Gallery4Item } from "@/components/ui/gallery4";

export const metadata = {
    title: "Case Studies & Portfolio | Optrizo Digital Solutions",
    description: "Explore our featured software engineering case studies, digital platforms, and cloud architecture deployments.",
};

export default async function ProjectsIndexPage() {
    const publishedProjects = await db.query.caseStudies.findMany({
        where: eq(caseStudies.published, true),
        orderBy: [desc(caseStudies.createdAt)],
    });

    const galleryItems: Gallery4Item[] = publishedProjects.map((project) => ({
        id: project.id.toString(),
        title: project.title,
        clientName: project.clientName || "Enterprise Partner",
        description: project.description || "Detailed case study of enterprise platform architecture and software engineering.",
        href: `/projects/${project.slug}`,
        image: project.coverImage || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop",
        technologies: Array.isArray(project.technologies) ? project.technologies : [],
    }));

    return (
        <div className="min-h-screen pt-8 pb-20">
            <Gallery4
                badge="OPTRIZO // SELECTED WORKS"
                title="Engineering Case Studies"
                description="Explore how we partner with market leaders to build high-performance web applications, striking brand platforms, and mission-critical cloud infrastructure."
                items={galleryItems}
            />
        </div>
    );
}
