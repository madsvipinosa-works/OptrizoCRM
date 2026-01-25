import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export default async function ProjectsIndexPage() {
    const publishedProjects = await db.query.projects.findMany({
        where: eq(projects.status, "published"),
        orderBy: [desc(projects.createdAt)],
    });

    return (
        <div className="container mx-auto px-4 py-24">
            <div className="text-center max-w-2xl mx-auto mb-16">
                <Badge variant="outline" className="mb-4 text-primary border-primary/20">Our Work</Badge>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Selected Case Studies</h1>
                <p className="text-lg text-muted-foreground">
                    Explore how we&apos;ve helped businesses transform their digital presence.
                </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {publishedProjects.map((project) => (
                    <Card key={project.id} className="bg-black/50 border-white/10 overflow-hidden hover:border-primary/50 transition-colors group">
                        <div className="relative h-48 w-full bg-white/5 group-hover:bg-white/10 transition-colors flex items-center justify-center text-muted-foreground">
                            {project.coverImage ? (
                                <Image
                                    src={project.coverImage}
                                    alt={project.title}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                            ) : (
                                <span className="text-muted-foreground">No Image</span>
                            )}
                        </div>

                        <CardHeader>
                            <div className="text-xs text-primary mb-2 uppercase tracking-widest font-bold">
                                {project.clientName}
                            </div>
                            <CardTitle className="text-2xl group-hover:text-primary transition-colors">
                                <Link href={`/projects/${project.slug}`}>
                                    {project.title}
                                </Link>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground line-clamp-3 text-sm">
                                {project.description}
                            </p>
                        </CardContent>
                        <CardFooter>
                            <Button asChild variant="link" className="px-0 text-white group-hover:text-primary">
                                <Link href={`/projects/${project.slug}`}>View Case Study &rarr;</Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
