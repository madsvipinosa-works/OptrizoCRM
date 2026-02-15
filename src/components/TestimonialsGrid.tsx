import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { RevealList, RevealItem } from "@/components/ui/scroll-reveal";

export async function TestimonialsGrid() {
    const allTestimonials = await db.query.testimonials.findMany({
        orderBy: [desc(testimonials.id)],
        limit: 3, // Show latest 3
    });

    if (allTestimonials.length === 0) {
        return <div className="text-center text-muted-foreground">Ask us for references!</div>;
    }

    return (
        <RevealList className="grid grid-cols-1 md:grid-cols-3 gap-8" stagger={0.2}>
            {allTestimonials.map((t) => (
                <RevealItem key={t.id} variant="scale">
                    <Card className="glass-card h-full flex flex-col justify-between hover:border-primary/50 transition-colors group p-6">
                        <CardContent className="p-0">
                            <div className="flex gap-1 text-primary mb-6">{"★".repeat(t.rating || 5)}</div>
                            <p className="text-gray-300 italic mb-8 text-lg leading-relaxed font-light">
                                &quot;{t.content.length > 200 ? t.content.slice(0, 200) + "..." : t.content}&quot;
                                {t.content.length > 200 && (
                                    <Link href="/testimonials" className="inline-flex items-center text-primary text-sm font-semibold hover:underline mt-2 ml-2 not-italic">
                                        Read More <ArrowRight className="h-3 w-3 ml-1" />
                                    </Link>
                                )}
                            </p>
                            <div className="flex items-center gap-4 mt-auto">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold border border-primary/20">
                                    {t.name.charAt(0)}
                                </div>
                                <div>
                                    <div className="font-bold text-white group-hover:text-primary transition-colors">{t.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {t.role} {t.company ? <span className="text-primary/60">• {t.company}</span> : ""}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </RevealItem>
            ))}
        </RevealList>
    );
}
