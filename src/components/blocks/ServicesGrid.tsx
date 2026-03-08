import { db } from "@/db";
import { services } from "@/db/schema";
import { asc } from "drizzle-orm";
import { SpotlightServicesGrid } from "@/components/ui/spotlight-service-card";

export async function ServicesGrid() {
    const allServices = await db.query.services.findMany({
        orderBy: [asc(services.order)],
        limit: 6,
    });

    if (allServices.length === 0) {
        return <div className="text-center text-muted-foreground">Services are being updated...</div>;
    }

    const enriched = allServices.map((service, index) => ({
        id: service.id.toString(),
        title: service.title,
        description: service.description,
        iconName: service.icon ?? "Box",
        colorIndex: index,
    }));

    return <SpotlightServicesGrid services={enriched} />;
}
