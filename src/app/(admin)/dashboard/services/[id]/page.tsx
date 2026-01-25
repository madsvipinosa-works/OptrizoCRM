import { ServiceForm } from "../new/service-form";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

interface Props {
    params: Promise<{ id: string }>;
}

export default async function EditServicePage({ params }: Props) {
    const { id } = await params;

    const service = await db.query.services.findFirst({
        where: eq(services.id, id),
    });

    if (!service) {
        notFound();
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Edit Service</h1>
                <p className="text-muted-foreground">Update service details.</p>
            </div>
            <ServiceForm initialData={service} />
        </div>
    );
}
