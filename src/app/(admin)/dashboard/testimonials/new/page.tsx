import { TestimonialForm } from "./testimonial-form";

export default function NewTestimonialPage() {
    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Add Testimonial</h1>
                <p className="text-muted-foreground">Add a glowing review.</p>
            </div>
            <TestimonialForm />
        </div>
    );
}
