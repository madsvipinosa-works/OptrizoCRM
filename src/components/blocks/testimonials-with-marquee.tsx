import { cn } from "@/lib/utils"
import { TestimonialCard, TestimonialAuthor } from "@/components/ui/testimonial-card"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { TypewriterHeader, TypewriterParagraph } from "@/components/ui/typewriter-text"

interface TestimonialsSectionProps {
    badge?: string
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
    badge = "OPTRIZO // CLIENT VOICES",
    title,
    description,
    testimonials,
    className,
}: TestimonialsSectionProps) {
    if (!testimonials || testimonials.length === 0) return null;

    return (
        <section
            className={cn(
                "text-foreground",
                "py-12 md:py-16 px-0",
                className
            )}
        >
            <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-8 text-center sm:gap-14">
                {/* Header matching Hero & Services */}
                <div className="flex flex-col items-center text-center px-4 max-w-3xl">
                    <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono tracking-widest uppercase w-fit mb-4 shadow-xs">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                        </span>
                        <span>{badge}</span>
                    </div>
                    <TypewriterHeader
                        text={title}
                        as="h2"
                        className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight uppercase text-foreground leading-[0.95] mb-4 text-center justify-center"
                    />
                    {description && (
                        <TypewriterParagraph
                            text={description}
                            as="p"
                            className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-xl text-center mx-auto"
                        />
                    )}
                </div>

                {/* Marquee Row */}
                <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
                    <div className="group flex overflow-hidden p-2 [--gap:1.5rem] [gap:var(--gap)] flex-row flex-nowrap [--duration:45s]">
                        {/* Copy 1 */}
                        <div className="flex shrink-0 items-center [gap:var(--gap)] animate-marquee flex-row flex-nowrap group-hover:[animation-play-state:paused]">
                            {[...Array(Math.max(2, Math.ceil(8 / testimonials.length)))].map((_, setIndex) =>
                                testimonials.map((testimonial, i) => (
                                    <TestimonialCard key={`a-${setIndex}-${i}`} {...testimonial} className="shrink-0 w-[320px] sm:w-[360px] max-w-none" />
                                ))
                            )}
                        </div>
                        {/* Copy 2 — seamlessly fills behind copy 1 */}
                        <div className="flex shrink-0 items-center [gap:var(--gap)] animate-marquee flex-row flex-nowrap group-hover:[animation-play-state:paused]" aria-hidden="true">
                            {[...Array(Math.max(2, Math.ceil(8 / testimonials.length)))].map((_, setIndex) =>
                                testimonials.map((testimonial, i) => (
                                    <TestimonialCard key={`b-${setIndex}-${i}`} {...testimonial} className="shrink-0 w-[320px] sm:w-[360px] max-w-none" />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Gradient Fade Edges matching page background */}
                    <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/4 bg-gradient-to-r from-background to-transparent sm:block z-10" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/4 bg-gradient-to-l from-background to-transparent sm:block z-10" />
                </div>

                {/* Tactile View All Testimonials Button */}
                <div className="flex items-center justify-center mt-2">
                    <Link
                        href="/testimonials"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border bg-card text-foreground hover:bg-primary hover:text-black font-mono text-xs uppercase tracking-wider transition-all duration-300 shadow-sm group"
                    >
                        <span>View All Testimonials</span>
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </section>
    )
}
