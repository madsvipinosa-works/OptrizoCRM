import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { getSiteSettings } from "@/features/cms/actions";
import { HeroSection } from "@/components/public/HeroSection";
import { ServicesGrid } from "@/components/blocks/ServicesGrid";
import GalleryHoverCarousel from "@/components/blocks/gallery-hover-carousel";
import { TestimonialsSection } from "@/components/blocks/testimonials-with-marquee";
import { db } from "@/db";
import { posts, caseStudies, testimonials } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

import { Gallery4, type Gallery4Item } from "@/components/ui/gallery4";

export const revalidate = 3600; // Revalidate every hour

import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { CTAScrollScale } from "@/components/blocks/cta-scroll-scale";
import { PinnedPanelsLayout, PinnedPanel } from "@/components/ui/pinned-panels-layout";

// ... existing imports

export default async function Home() {
    const settings = await getSiteSettings();

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

    // Fetch active case studies for portfolio showcase
    const activeProjects = await db.query.caseStudies.findMany({
        where: eq(caseStudies.published, true),
        orderBy: [desc(caseStudies.createdAt)],
        limit: 6,
    });

    const featuredProjects: Gallery4Item[] = activeProjects.map((project) => ({
        id: project.id.toString(),
        title: project.title,
        clientName: project.clientName || "Enterprise Partner",
        description: project.description || "Detailed case study of enterprise software and scalable cloud architecture.",
        href: `/projects/${project.slug}`,
        image: project.coverImage || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop",
        technologies: Array.isArray(project.technologies) ? project.technologies : [],
    }));

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
        summary: post.excerpt || post.title,
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
        <PinnedPanelsLayout className="relative z-10 w-full">
            {/* Panel 1: Hero Section */}
            <PinnedPanel id="hero" hasTopRounding={false}>
                <HeroSection
                    titleLine1="OPTRIZO"
                    titleLine2="CUSTOM SOLUTIONS"
                    badgeText="OPTRIZO // CUSTOM SOLUTIONS"
                    taglineBold="POWERED BY INNOVATION."
                    description={settings?.heroDescription || "We engineer bespoke web platforms, enterprise software, and scalable digital infrastructure through modern architecture."}
                />
            </PinnedPanel>

            {/* Panel 2: Demo Video Scroll Section (if enabled) */}
            {settings?.demoVideoUrl && (
                <PinnedPanel id="demo-video">
                    <div className="relative z-10 w-full max-w-[1400px] mx-auto py-12 md:py-20">
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
                    </div>
                </PinnedPanel>
            )}

            {/* Panel 3: Services Section with Interactive Animated Hover Modal */}
            <PinnedPanel id="services">
                <div className="relative z-10 w-full max-w-[1400px] mx-auto">
                    <ServicesGrid />
                </div>
            </PinnedPanel>

            {/* Panel 4: Featured Case Studies / Projects (Gallery4 Carousel) */}
            <PinnedPanel id="projects">
                <div className="relative z-10 w-full max-w-[1400px] mx-auto py-12 md:py-16">
                    <Gallery4
                        badge="OPTRIZO // SELECTED WORKS"
                        title="Featured Case Studies"
                        description="Discover how we partner with ambitious companies to engineer high-performance web applications, striking digital experiences, and mission-critical cloud infrastructure."
                        items={featuredProjects}
                        viewAllHref="/projects"
                        viewAllText="View All Projects"
                    />
                </div>
            </PinnedPanel>

            {/* Panel 5: Testimonials Section */}
            <PinnedPanel id="testimonials">
                <div className="relative z-10 w-full max-w-[1400px] mx-auto py-12 md:py-16">
                    <TestimonialsSection
                        title="Trusted by Market Leaders"
                        description="See what our partners are achieving with Optrizo."
                        testimonials={testimonialItems}
                    />
                </div>
            </PinnedPanel>

            {/* Panel 6: Blog Teaser Section */}
            <PinnedPanel id="blog">
                <div className="relative z-10 w-full max-w-[1400px] mx-auto">
                    <section className="container px-4 mx-auto py-24 md:py-32">
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
                </div>
            </PinnedPanel>

            {/* Panel 7 (Terminal): CTA Section (Scroll Scaling) */}
            <PinnedPanel id="cta" isLast={true}>
                <div className="relative z-10 w-full max-w-[1400px] mx-auto">
                    <CTAScrollScale />
                </div>
            </PinnedPanel>
        </PinnedPanelsLayout>
    );
}
