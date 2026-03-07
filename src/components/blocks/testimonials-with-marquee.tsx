import { cn } from "@/lib/utils"
import { TestimonialCard, TestimonialAuthor } from "@/components/ui/testimonial-card"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SectionHeading } from "@/components/ui/section-heading"

interface TestimonialsSectionProps {
    title: string
    description: string
    testimonials: Array<{
        author: TestimonialAuthor
        text: string
        href?: string
        rating?: number
    }>
    className?: string
}

export function TestimonialsSection({
    title,
    description,
    testimonials,
    className,
}: TestimonialsSectionProps) {
    return (
        <section
            className={cn(
                "bg-background text-foreground",
                "py-12 sm:py-24 md:py-32 px-0",
                className
            )}
        >
            <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-4 text-center sm:gap-16">
                <div className="flex flex-col items-center gap-4 px-4 sm:gap-8">
                    <SectionHeading text={title} className="max-w-[720px] text-3xl sm:text-5xl text-center" />
                    <p className="text-md max-w-[600px] font-medium text-muted-foreground sm:text-xl">
                        {description}
                    </p>
                </div>

                <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
                    <div
                        className="group flex overflow-hidden p-2 [--gap:1rem] [gap:var(--gap)] flex-row [--duration:40s]"
                    >
                        <div className="flex shrink-0 justify-around [gap:var(--gap)] animate-marquee flex-row group-hover:[animation-play-state:paused]">
                            {[...Array(Math.max(2, Math.ceil(8 / testimonials.length)))].map((_, setIndex) =>
                                testimonials.map((testimonial, i) => (
                                    <TestimonialCard
                                        key={`${setIndex}-${i}`}
                                        {...testimonial}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/3 bg-gradient-to-r from-background sm:block" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-background sm:block" />
                </div>

                <Link
                    href="/testimonials"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors group mt-4"
                >
                    View all testimonials
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>
        </section>
    )
}
