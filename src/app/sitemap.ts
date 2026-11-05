import { getPublishedPortfolio, getPublishedServices } from "@/features/cms/content/public-queries";
import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://optrizo.com";

    // 1. Static Routes
    const routes = [
        "",
        "/about",
        "/services",
        "/projects",
        "/contact",
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: route === "" ? 1 : 0.8,
    }));

    // 2. Dynamic Case Studies (Portfolio Projects - published only)
    const publishedPortfolio = await getPublishedPortfolio();
    const projectRoutes = publishedPortfolio.map((project) => ({
        url: `${baseUrl}/projects/${project.slug}`,
        lastModified: project.publishedAt || new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.7,
    }));

    // 3. Dynamic Services (published only, showOnServicesPage = true)
    const publishedServices = await getPublishedServices({ forInquiry: false });
    const serviceRoutes = publishedServices.map((service) => ({
        url: `${baseUrl}/services/${service.slug || service.id}`,
        lastModified: service.updatedAt || service.createdAt || new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.8,
    }));

    return [...routes, ...projectRoutes, ...serviceRoutes];
}

