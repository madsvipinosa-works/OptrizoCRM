import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const baseUrl = "https://optrizo.com"; // Replace with actual domain

    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: ["/admin/", "/dashboard/"],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
