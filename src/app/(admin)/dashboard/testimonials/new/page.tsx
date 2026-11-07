import { notFound } from "next/navigation";
import { TestimonialForm } from "@/features/cms/components/TestimonialForm";

export default function NewTestimonialPage() {
    notFound();
    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Add Testimonial</h1>
                <p className="text-muted-foreground">Add a glowing review.</p>
            </div>
            <TestimonialForm />
        </div>
    );
}
