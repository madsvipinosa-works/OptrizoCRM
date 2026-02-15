import { db } from "@/db";
import { services } from "@/db/schema";
import { asc } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Box } from "lucide-react";
import * as Icons from "lucide-react";

import { RevealList, RevealItem } from "@/components/ui/scroll-reveal";

export async function ServicesGrid() {
    const allServices = await db.query.services.findMany({
        orderBy: [asc(services.order)],
        limit: 6, // Show top 6 on home page
    });

    if (allServices.length === 0) {
        return <div className="text-center text-muted-foreground">Services are being updated...</div>;
    }

    return (
        <RevealList className="grid grid-cols-1 md:grid-cols-3 gap-6" stagger={0.1}>
            {allServices.map((service) => {
                // @ts-expect-error - Dynamic Icon Lookup
                const IconComponent = Icons[service.icon] || Box;

                return (
                    <RevealItem key={service.id} variant="scale">
                        <Card className="glass-card hover:border-primary/50 transition-colors group h-full">
                            <CardHeader>
                                <IconComponent className="h-12 w-12 text-primary mb-2 group-hover:scale-110 transition-transform duration-300" />
                                <CardTitle className="text-xl">{service.title}</CardTitle>
                                <CardDescription className="text-base line-clamp-3">
                                    {service.description}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </RevealItem>
                );
            })}
        </RevealList>
    );
}
