import { getPublishedServices } from "@/features/cms/content/public-queries";
import { ServicesWithAnimatedHoverModal, ServiceItem } from "@/components/ui/services-with-animated-hover-modal";
import { SERVICE_METADATA_PRESETS } from "@/features/cms/constants/service-defaults";
import type { services as servicesTable } from "@/db/schema";

const defaultFallbackServices: ServiceItem[] = [
    {
        id: "default-1",
        title: "Custom Web Applications",
        category: "Architecture & Fullstack",
        description: "Bespoke Next.js and React enterprise applications engineered for speed, scalability, and seamless user experience.",
        image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1000&auto=format&fit=crop",
        color: "#05160b",
        link: "/contact",
        inclusions: SERVICE_METADATA_PRESETS["Custom Web Applications"].inclusions,
        deliverables: SERVICE_METADATA_PRESETS["Custom Web Applications"].deliverables,
        scopeOverview: SERVICE_METADATA_PRESETS["Custom Web Applications"].scopeOverview,
        timelineEstimate: SERVICE_METADATA_PRESETS["Custom Web Applications"].timelineEstimate,
        targetAudience: SERVICE_METADATA_PRESETS["Custom Web Applications"].targetAudience,
    },
    {
        id: "default-2",
        title: "Cloud & Scalable Infrastructure",
        category: "DevOps & Microservices",
        description: "High-availability cloud architecture, automated CI/CD pipelines, and robust Kubernetes container management.",
        image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1000&auto=format&fit=crop",
        color: "#0a0a0a",
        link: "/contact",
        inclusions: SERVICE_METADATA_PRESETS["Cloud & Scalable Infrastructure"].inclusions,
        deliverables: SERVICE_METADATA_PRESETS["Cloud & Scalable Infrastructure"].deliverables,
        scopeOverview: SERVICE_METADATA_PRESETS["Cloud & Scalable Infrastructure"].scopeOverview,
        timelineEstimate: SERVICE_METADATA_PRESETS["Cloud & Scalable Infrastructure"].timelineEstimate,
        targetAudience: SERVICE_METADATA_PRESETS["Cloud & Scalable Infrastructure"].targetAudience,
    },
    {
        id: "default-3",
        title: "UI/UX Design & Brand Systems",
        category: "Design & Interaction",
        description: "Tactile cyber-minimalist design systems, interactive web experiences, and award-winning brand identity frameworks.",
        image: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=1000&auto=format&fit=crop",
        color: "#02240e",
        link: "/contact",
        inclusions: SERVICE_METADATA_PRESETS["UI/UX Design & Brand Systems"].inclusions,
        deliverables: SERVICE_METADATA_PRESETS["UI/UX Design & Brand Systems"].deliverables,
        scopeOverview: SERVICE_METADATA_PRESETS["UI/UX Design & Brand Systems"].scopeOverview,
        timelineEstimate: SERVICE_METADATA_PRESETS["UI/UX Design & Brand Systems"].timelineEstimate,
        targetAudience: SERVICE_METADATA_PRESETS["UI/UX Design & Brand Systems"].targetAudience,
    },
    {
        id: "default-4",
        title: "Mobile App Engineering",
        category: "iOS & Android Platforms",
        description: "Native and cross-platform mobile apps engineered with modern reactive frameworks and real-time synchronization.",
        image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=1000&auto=format&fit=crop",
        color: "#0b1928",
        link: "/contact",
        inclusions: SERVICE_METADATA_PRESETS["Mobile App Engineering"].inclusions,
        deliverables: SERVICE_METADATA_PRESETS["Mobile App Engineering"].deliverables,
        scopeOverview: SERVICE_METADATA_PRESETS["Mobile App Engineering"].scopeOverview,
        timelineEstimate: SERVICE_METADATA_PRESETS["Mobile App Engineering"].timelineEstimate,
        targetAudience: SERVICE_METADATA_PRESETS["Mobile App Engineering"].targetAudience,
    },
];

interface ServicesGridProps {
    services?: (typeof servicesTable.$inferSelect)[];
}

export async function ServicesGrid({ services: propServices }: ServicesGridProps = {}) {
    let list = propServices;
    if (!list || list.length === 0) {
        const published = await getPublishedServices({ forInquiry: false });
        list = published.slice(0, 3);
    }

    const items: ServiceItem[] = list.length > 0
        ? list.slice(0, 3).map((service, index) => ({
            id: service.id,
            title: service.title,
            slug: service.slug,
            description: service.description,
            category: service.category || (index === 0 ? "Architecture & Fullstack" : index === 1 ? "Cloud & DevOps" : "Digital Systems"),
            image: service.image || defaultFallbackServices[index % defaultFallbackServices.length].image,
            color: service.color || defaultFallbackServices[index % defaultFallbackServices.length].color,
            link: service.link || "/contact",
            icon: service.icon,
            order: service.order,
            inclusions: (Array.isArray(service.inclusions) ? (service.inclusions as string[]) : null),
            deliverables: (Array.isArray(service.deliverables) ? (service.deliverables as string[]) : null),
            scopeOverview: service.scopeOverview,
            timelineEstimate: service.timelineEstimate,
            targetAudience: service.targetAudience,
        }))
        : defaultFallbackServices;

    return <ServicesWithAnimatedHoverModal services={items} />;
}
