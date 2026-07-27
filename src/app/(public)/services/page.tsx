import { db } from "@/db";
import { services } from "@/db/schema";
import { asc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ServiceCardItem } from "@/components/public/ServiceCardItem";

const SERVICE_ASSETS: Record<string, { images: string[]; tags: string[] }> = {
    "Web Development": {
        images: [
            "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1000&auto=format&fit=crop",
        ],
        tags: ["Web", "Full-Stack"],
    },
    "UI/UX Design": {
        images: [
            "https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=1000&auto=format&fit=crop",
        ],
        tags: ["Design", "Prototyping"],
    },
    "Mobile App Development": {
        images: [
            "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1526498460520-4c246339dccb?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1551650975-87deedd944c3?q=80&w=1000&auto=format&fit=crop",
        ],
        tags: ["iOS", "Android"],
    },
    "AI Integration": {
        images: [
            "https://images.unsplash.com/photo-1677442136019-21780efad99a?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1000&auto=format&fit=crop",
        ],
        tags: ["AI/ML", "Automation"],
    },
    "Cloud & DevOps": {
        images: [
            "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1000&auto=format&fit=crop",
        ],
        tags: ["Cloud", "DevOps"],
    },
};

const DEFAULT_IMAGE_SETS = [
    [
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=1000&auto=format&fit=crop",
    ],
    [
        "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1000&auto=format&fit=crop",
    ],
];

export default async function ServicesPage() {
    const session = await auth();
    const isLoggedIn = !!session?.user;

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

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-24 items-stretch">
                {allServices.map((service, index) => {
                    const mappedAsset = SERVICE_ASSETS[service.title] || {
                        images: DEFAULT_IMAGE_SETS[index % DEFAULT_IMAGE_SETS.length],
                        tags: ["Service", "Solutions"],
                    };

                    return (
                        <div key={service.id} className="flex justify-center">
                            <ServiceCardItem
                                service={service}
                                images={mappedAsset.images}
                                tags={mappedAsset.tags}
                                isLoggedIn={isLoggedIn}
                            />
                        </div>
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
