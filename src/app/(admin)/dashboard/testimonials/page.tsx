import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Plus, Edit } from "lucide-react";
import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { desc } from "drizzle-orm";
import { DeleteTestimonialButton } from "@/features/cms/components/DeleteTestimonialButton";

export default async function TestimonialsPage() {
    const allTestimonials = await db.query.testimonials.findMany({
        orderBy: [desc(testimonials.id)], // Just order by newest for now
    });

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Testimonials</h1>
                    <p className="text-muted-foreground">What our clients say.</p>
                </div>
                <Button asChild className="bg-primary text-black font-bold">
                    <Link href="/dashboard/testimonials/new">
                        <Plus className="mr-2 h-4 w-4" /> Add Testimonial
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allTestimonials.map((t) => (
                    <Card key={t.id} className="bg-black/40 border-primary/20 flex flex-col justify-between">
                        <CardHeader>
                            <div className="flex text-yellow-500 mb-2 text-sm">
                                {"★".repeat(t.rating || 5)}
                            </div>
                            <CardDescription className="line-clamp-4 italic text-white/80">
                                &quot;{t.content}&quot;
                            </CardDescription>
                            <div className="mt-4">
                                <CardTitle className="text-base">{t.name}</CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    {t.role} {t.company ? `at ${t.company}` : ""}
                                </p>
                            </div>
                        </CardHeader>
                        <CardFooter className="flex justify-end gap-2 border-t border-white/10 pt-4">
                            <Button asChild size="icon" variant="ghost" className="h-8 w-8 hover:text-primary">
                                <Link href={`/dashboard/testimonials/${t.id}`}>
                                    <Edit className="h-4 w-4" />
                                </Link>
                            </Button>
                            <DeleteTestimonialButton id={t.id} />
                        </CardFooter>
                    </Card>
                ))}

                {allTestimonials.length === 0 && (
                    <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-lg">
                        <p className="text-muted-foreground">No testimonials yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
