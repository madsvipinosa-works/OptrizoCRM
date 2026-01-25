import { db } from "@/db";
import { services } from "@/db/schema";
import { asc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Box } from "lucide-react";
import * as Icons from "lucide-react";

export default async function ServicesPage() {
    const allServices = await db.query.services.findMany({
        orderBy: [asc(services.order)],
    });

    return (
        <div className="container mx-auto px-4 py-24">
            <div className="text-center max-w-3xl mx-auto mb-16">
                <Badge variant="secondary" className="mb-4 text-primary">What We Do</Badge>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">End-to-End Digital Solutions</h1>
                <p className="text-xl text-muted-foreground">
                    From initial concept to global deployment, we provide the technical expertise to turn your vision into reality.
                </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-24">
                {allServices.map((service) => {
                    // Dynamic Icon Lookup
                    // @ts-expect-error - Lucide icons are many
                    const IconComponent = Icons[service.icon] || Box;

                    return (
                        <Card key={service.id} className="bg-black/40 border-primary/10 hover:border-primary/50 transition-colors group">
                            <CardHeader>
                                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <IconComponent className="h-6 w-6" />
                                </div>
                                <CardTitle className="text-2xl">{service.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground leading-relaxed">
                                    {service.description}
                                </p>
                            </CardContent>
                        </Card>
                    );
                })}

                {allServices.length === 0 && (
                    <div className="col-span-full py-12 text-center border border-dashed border-white/10 rounded-lg">
                        <p className="text-muted-foreground">Services are being updated. Check back soon!</p>
                    </div>
                )}
            </div>

            {/* CTA */}
            <div className="bg-gradient-to-r from-primary/10 to-transparent p-12 rounded-2xl border border-primary/20 text-center">
                <h2 className="text-3xl font-bold mb-4">Need a custom solution?</h2>
                <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                    We specialize in solving complex problems. If you don&apos;t see exactly what you need, let&apos;s talk about your unique requirements.
                </p>
                <Button asChild size="lg" className="bg-primary text-black font-bold hover:bg-primary/90">
                    <Link href="/contact">
                        Contact Us <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>
        </div>
    );
}
