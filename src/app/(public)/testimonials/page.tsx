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
        <div className="container mx-auto px-4 py-28 md:py-36">
            <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
                <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono tracking-widest uppercase w-fit mb-4 shadow-xs">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <span>OPTRIZO // CLIENT FEEDBACK</span>
                </div>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight uppercase text-foreground leading-[0.95] mb-6">
                    Client Testimonials
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
                    Don&apos;t just take our word for it. Here is what our enterprise partners have to say about scaling with Optrizo.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {allTestimonials.map((t) => (
                    <Card key={t.id} className="rounded-3xl border border-border/80 bg-card p-6 sm:p-7 shadow-sm hover:shadow-xl hover:border-primary/50 transition-all duration-300 flex flex-col justify-between overflow-hidden">
                        <CardContent className="p-0 flex flex-col justify-between h-full overflow-hidden">
                            <div className="overflow-hidden">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex gap-1 text-primary">{"★".repeat(t.rating || 5)}</div>
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold px-2.5 py-0.5 rounded-full border border-primary/20 bg-primary/5">
                                        VERIFIED
                                    </span>
                                </div>
                                <p className="text-foreground/90 italic mb-6 text-sm sm:text-base leading-relaxed">&quot;{t.content}&quot;</p>
                            </div>
                            <div className="pt-4 border-t border-border/60 mt-auto w-full min-w-0 overflow-hidden">
                                <div className="font-black uppercase tracking-tight text-foreground text-sm sm:text-base truncate w-full block">{t.name}</div>
                                <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5 line-clamp-2 break-words leading-snug w-full block">
                                    {t.role} {t.company ? `@ ${t.company}` : ""}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {allTestimonials.length === 0 && (
                <div className="text-center py-20 bg-card rounded-3xl border border-border/80 max-w-xl mx-auto">
                    <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">Testimonials are being curated. Check back soon!</p>
                </div>
            )}
        </div>
    );
}
