import { TestimonialForm } from "../new/testimonial-form";
import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

interface Props {
    params: Promise<{ id: string }>;
}

export default async function EditTestimonialPage({ params }: Props) {
    const { id } = await params;

    const testimonial = await db.query.testimonials.findFirst({
        where: eq(testimonials.id, id),
    });

    if (!testimonial) {
        notFound();
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Edit Testimonial</h1>
                <p className="text-muted-foreground">Update client feedback.</p>
            </div>
            <TestimonialForm initialData={testimonial} />
        </div>
    );
}
