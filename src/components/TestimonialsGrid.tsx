import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";

export async function TestimonialsGrid() {
    const allTestimonials = await db.query.testimonials.findMany({
        orderBy: [desc(testimonials.id)],
        limit: 3, // Show latest 3
    });

    if (allTestimonials.length === 0) {
        return <div className="text-center text-muted-foreground">Ask us for references!</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {allTestimonials.map((t) => (
                <Card key={t.id} className="bg-black/40 border-white/10">
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
    );
}
