import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function TestimonialsPage() {
    const allTestimonials = await db.query.testimonials.findMany({
        where: eq(testimonials.active, true),
        orderBy: [desc(testimonials.id)],
    });

    return (
        <div className="container mx-auto px-4 py-24">
            <div className="text-center max-w-2xl mx-auto mb-16">
                <Badge variant="outline" className="mb-4 text-primary border-primary/20">Success Stories</Badge>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Client Testimonials</h1>
                <p className="text-lg text-muted-foreground">
                    Don&apos;t just take our word for it. Here is what our partners have to say about working with Optrizo.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {allTestimonials.map((t) => (
                    <Card key={t.id} className="bg-black/40 border-white/10 break-inside-avoid mb-6">
                        <CardContent className="pt-6">
                            <div className="flex gap-1 text-primary mb-4">{"★".repeat(t.rating || 5)}</div>
                            <p className="text-gray-300 italic mb-6 text-lg leading-relaxed">&quot;{t.content}&quot;</p>
                            <div>
                                <div className="font-bold text-white">{t.name}</div>
                                <div className="text-sm text-muted-foreground">
                                    {t.role} {t.company ? `, ${t.company}` : ""}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {allTestimonials.length === 0 && (
                <div className="text-center py-20 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-muted-foreground">Testimonials are being curated. Check back soon!</p>
                </div>
            )}
        </div>
    );
}
