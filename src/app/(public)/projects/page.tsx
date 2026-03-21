import { db } from "@/db";
import { projects } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NewsCards, type NewsCard } from "@/components/ui/news-cards";
import { formatDistanceToNow } from "date-fns";

export default async function ProjectsIndexPage() {
    const publishedProjects = await db.query.projects.findMany({
        where: eq(projects.status, "published"),
        orderBy: [desc(projects.createdAt)],
    });

    const mappedProjects: NewsCard[] = publishedProjects.map((project) => ({
        id: project.id.toString(),
        title: project.title,
        category: project.clientName || 'Client Project',
        subcategory: "Case Study",
        timeAgo: formatDistanceToNow(project.createdAt, { addSuffix: true }),
        location: "Global",
        image: project.coverImage || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop",
        gradientColors: ["from-primary/20", "to-blue-500/20"],
        content: [
            project.description || "",
            project.content || "Detailed case study content coming soon."
        ].filter(Boolean) as string[]
    }));

    return (
        <div className="container mx-auto px-0 min-h-screen">
            <NewsCards
                title="Selected Case Studies"
                subtitle="Explore how we've helped businesses transform their digital presence."
                newsCards={mappedProjects}
            />
        </div>
    );
}
