import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Plus, Edit, Cuboid } from "lucide-react"; // Default icon
import { db } from "@/db";
import { services } from "@/db/schema";
import { asc } from "drizzle-orm";
import { DeleteServiceButton } from "@/features/cms/components/DeleteServiceButton";

export default async function ServicesPage() {
    const allServices = await db.query.services.findMany({
        orderBy: [asc(services.order)],
    });

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Services</h1>
                    <p className="text-muted-foreground">Manage your offerings.</p>
                </div>
                <Button asChild className="bg-primary text-black font-bold">
                    <Link href="/dashboard/services/new">
                        <Plus className="mr-2 h-4 w-4" /> Add Service
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allServices.map((service) => (
                    <Card key={service.id} className="bg-black/40 border-primary/20 flex flex-col justify-between">
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-primary/20 rounded-lg text-primary">
                                    {/* Since icons are strings, we just show a generic one or the name for now */}
                                    <Cuboid className="h-5 w-5" />
                                </div>
                                <CardTitle className="text-lg">{service.title}</CardTitle>
                            </div>
                            <CardDescription className="line-clamp-3">
                                {service.description}
                            </CardDescription>
                            {service.icon && (
                                <p className="text-xs text-muted-foreground mt-2">Icon: {service.icon}</p>
                            )}
                        </CardHeader>
                        <CardFooter className="flex justify-end gap-2 border-t border-white/10 pt-4">
                            <Button asChild size="icon" variant="ghost" className="h-8 w-8 hover:text-primary">
                                <Link href={`/dashboard/services/${service.id}`}>
                                    <Edit className="h-4 w-4" />
                                </Link>
                            </Button>
                            <DeleteServiceButton id={service.id} />
                        </CardFooter>
                    </Card>
                ))}

                {allServices.length === 0 && (
                    <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-lg">
                        <p className="text-muted-foreground">No services found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
