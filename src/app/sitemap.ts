import { db } from "@/db";
import { posts, projects } from "@/db/schema";
import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = "https://optrizo.com"; // Replace with actual domain

    // 1. Static Routes
    const routes = [
        "",
        "/about",
        "/services",
        "/projects",
        "/blog",
        "/contact",
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: route === "" ? 1 : 0.8,
    }));

    // 2. Dynamic Blog Posts
    const allPosts = await db.select({ slug: posts.slug, updatedAt: posts.updatedAt }).from(posts);
    const postRoutes = allPosts.map((post) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
    }));

    // 3. Dynamic Projects
    const allProjects = await db.select({ slug: projects.slug, createdAt: projects.createdAt }).from(projects);
    const projectRoutes = allProjects.map((project) => ({
        url: `${baseUrl}/projects/${project.slug}`,
        lastModified: project.createdAt, // Projects usually don't have updatedAt yet, using createdAt
        changeFrequency: "monthly" as const,
        priority: 0.7,
    }));

    return [...routes, ...postRoutes, ...projectRoutes];
}
