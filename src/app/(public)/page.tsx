import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { getSiteSettings } from "@/features/cms/actions";
import { HeroSection } from "@/components/public/HeroSection";
import { ServicesGrid } from "@/components/blocks/ServicesGrid";
import GalleryHoverCarousel from "@/components/blocks/gallery-hover-carousel";
import { TestimonialsSection } from "@/components/blocks/testimonials-with-marquee";
import { db } from "@/db";
import { posts, testimonials } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const revalidate = 3600; // Revalidate every hour

import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { CTAScrollScale } from "@/components/blocks/cta-scroll-scale";

// ... existing imports

export default async function Home() {
    const settings = await getSiteSettings();

    // Fetch only what's needed or nothing if static
    // (Removed unused parallel fetch)

    // Fetch latest blog posts for the carousel
    const publishedPosts = await db.query.posts.findMany({
        where: eq(posts.published, true),
        orderBy: [desc(posts.createdAt)],
        limit: 4,
    });

    // Fetch active testimonials for the marquee
    const allTestimonials = await db.query.testimonials.findMany({
        where: eq(testimonials.active, true),
        orderBy: [desc(testimonials.id)],
    });

    const testimonialItems = allTestimonials.map((t) => ({
        author: {
            name: t.name,
            handle: t.role ? `${t.role}${t.company ? ` @ ${t.company}` : ''}` : (t.company ?? ''),
            avatar: t.image ?? undefined,
        },
        text: t.content,
        rating: t.rating ?? 5,
    }));

    const carouselItems = publishedPosts.map((post) => ({
        id: post.id.toString(),
        title: post.title,
        summary: post.slug, // Using slug as excerpt for now
        url: `/blog/${post.slug}`,
        image: post.coverImage || "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2670&auto=format&fit=crop",
    }));

    // Helper: auto-convert YouTube/Facebook watch URLs to embed URLs
    const toEmbedUrl = (url: string) => {
        try {
            const u = new URL(url);
            // YouTube
            if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
                return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
            }
            if (u.hostname === "youtu.be") {
                return `https://www.youtube.com/embed${u.pathname}`;
            }
            // Facebook (Videos, Reels, Watch)
            if (
                u.hostname.includes("facebook.com") &&
                (u.pathname.includes("/videos/") || u.pathname.includes("/watch") || u.pathname.includes("/reel/"))
            ) {
                return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=734&height=476&appId`;
            }
        } catch {
            // Not a URL, return as-is
        }
        return url;
    };

    return (
        <div className="relative z-10 w-full max-w-[1400px] mx-auto">
            {/* Animated Hero Section */}
            <HeroSection
                title={settings?.heroTitle || "Build Your Digital Future"}
                description={settings?.heroDescription || "Optrizo is a premium software development agency crafting high-performance websites, complex web apps, and scalable digital solutions."}
            />

            {/* Demo Video Scroll Section */}
            {settings?.demoVideoUrl && (
                <ContainerScroll
                    titleComponent={
                        <div className="mb-4">
                            <SectionHeading
                                text="See Optrizo in Action"
                                className="text-3xl md:text-5xl mb-4"
                            />
                            <p className="text-muted-foreground text-lg mt-4">
                                Watch how we transform ideas into high-performance digital products.
                            </p>
                        </div>
                    }
                >
                    <div className="relative w-full h-full">
                        {settings.demoVideoUrl.endsWith(".mp4") ? (
                            <video
                                src={settings.demoVideoUrl}
                                autoPlay
                                muted
                                loop
                                playsInline
                                className="w-full h-full object-cover rounded-2xl"
                            />
                        ) : (
                            <iframe
                                src={toEmbedUrl(settings.demoVideoUrl)}
                                className="w-full h-full rounded-2xl"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title="Optrizo Demo Video"
                            />
                        )}
                    </div>
                </ContainerScroll>
            )}


            {/* Services Section (Dynamic) */}
            <section className="container px-4 mx-auto py-32">
                <ScrollReveal className="flex flex-col items-center mb-16 text-center">
                    <Badge variant="secondary" className="mb-4 text-primary">Our Expertise</Badge>
                    <SectionHeading text="End-to-End Digital Solutions" className="text-4xl mb-4" />
                    <p className="text-muted-foreground max-w-2xl mx-auto">We don&apos;t just write code; we build digital assets that drive growth.</p>
                </ScrollReveal>

                <ServicesGrid />
            </section>

            {/* Testimonials Section */}
            <TestimonialsSection
                title="Trusted by Market Leaders"
                description="See what our partners are achieving with Optrizo."
                testimonials={testimonialItems}
            />

            {/* Blog Teaser Section */}
            <section className="container px-4 mx-auto py-32">
                <ScrollReveal className="flex justify-between items-end mb-12">
                    <div>
                        <Badge variant="secondary" className="mb-4 text-primary">Latest Insights</Badge>
                        <SectionHeading text="From The Blog" className="text-3xl tracking-tight" />
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/blog">View All Articles</Link>
                    </Button>
                </ScrollReveal>
                <GalleryHoverCarousel items={carouselItems} />
            </section>

            {/* CTA Section (Scroll Scaling) */}
            <CTAScrollScale />
        </div>
    );
}
