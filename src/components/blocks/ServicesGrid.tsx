import { db } from "@/db";
import { services } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { ServicesWithAnimatedHoverModal, ServiceItem } from "@/components/ui/services-with-animated-hover-modal";

const defaultFallbackServices: ServiceItem[] = [
    {
        id: "default-1",
        title: "Custom Web Applications",
        category: "Architecture & Fullstack",
        description: "Bespoke Next.js and React enterprise applications engineered for speed, scalability, and seamless user experience.",
        image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1000&auto=format&fit=crop",
        color: "#05160b",
        link: "/contact",
    },
    {
        id: "default-2",
        title: "Cloud & Scalable Infrastructure",
        category: "DevOps & Microservices",
        description: "High-availability cloud architecture, automated CI/CD pipelines, and robust Kubernetes container management.",
        image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1000&auto=format&fit=crop",
        color: "#0a0a0a",
        link: "/contact",
    },
    {
        id: "default-3",
        title: "UI/UX Design & Brand Systems",
        category: "Design & Interaction",
        description: "Tactile cyber-minimalist design systems, interactive web experiences, and award-winning brand identity frameworks.",
        image: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=1000&auto=format&fit=crop",
        color: "#02240e",
        link: "/contact",
    },
    {
        id: "default-4",
        title: "Mobile App Engineering",
        category: "iOS & Android Platforms",
        description: "Native and cross-platform mobile apps engineered with modern reactive frameworks and real-time synchronization.",
        image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=1000&auto=format&fit=crop",
        color: "#0b1928",
        link: "/contact",
    },
];

export async function ServicesGrid() {
    // Only query up to 4 services that have been explicitly chosen for the landing page showcase
    let dbServices = await db.query.services.findMany({
        where: eq(services.isFeatured, true),
        orderBy: [asc(services.order)],
        limit: 4,
    });

    // Graceful fallback: If no services are currently flagged as featured, fallback to top 4 services
    if (dbServices.length === 0) {
        dbServices = await db.query.services.findMany({
            orderBy: [asc(services.order)],
            limit: 4,
        });
    }

    const items: ServiceItem[] = dbServices.length > 0
        ? dbServices.slice(0, 4).map((service, index) => ({
            id: service.id,
            title: service.title,
            description: service.description,
            category: service.category || (index === 0 ? "Architecture & Fullstack" : index === 1 ? "Cloud & DevOps" : "Digital Systems"),
            image: service.image || defaultFallbackServices[index % defaultFallbackServices.length].image,
            color: service.color || defaultFallbackServices[index % defaultFallbackServices.length].color,
            link: service.link || "/contact",
            icon: service.icon,
            order: service.order,
        }))
        : defaultFallbackServices;

    return <ServicesWithAnimatedHoverModal services={items} />;
}
