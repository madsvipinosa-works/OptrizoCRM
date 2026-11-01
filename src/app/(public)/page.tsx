import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

import { getSiteSettings } from "@/features/cms/actions";
import { HeroSection } from "@/components/public/HeroSection";
import { ServicesGrid } from "@/components/blocks/ServicesGrid";
import { db } from "@/db";
import { caseStudies } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

import { Gallery4, type Gallery4Item } from "@/components/ui/gallery4";

export const dynamic = "force-static";
export const revalidate = 3600; // Revalidate every hour (ISR - refreshed)

import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { CTAScrollScale } from "@/components/blocks/cta-scroll-scale";
import { PinnedPanelsLayout, PinnedPanel } from "@/components/ui/pinned-panels-layout";
import { TypewriterHeader, TypewriterParagraph } from "@/components/ui/typewriter-text";

// ... existing imports

function optimizeImageUrl(url: string | null | undefined, width = 80, height = 80, quality = 65): string | undefined {
    if (!url) return undefined;
    try {
        if (url.includes("images.unsplash.com")) {
            const u = new URL(url);
            u.searchParams.set("w", width.toString());
            if (height) u.searchParams.set("h", height.toString());
            u.searchParams.set("fit", "crop");
            u.searchParams.set("auto", "format");
            u.searchParams.set("q", quality.toString());
            return u.toString();
        }
    } catch {
        // Return original if parsing fails
    }
    return url;
}

export default async function Home() {
    const settings = await getSiteSettings();

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
        image: optimizeImageUrl(project.coverImage, 640, 420, 65) || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=65&w=640&auto=format&fit=crop",
        technologies: Array.isArray(project.technologies) ? project.technologies : [],
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
                    title={settings?.heroTitle || undefined}
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
                                <div className="mb-4 text-center">
                                    <TypewriterHeader
                                        text="See Optrizo in Action"
                                        as="h2"
                                        className="text-3xl md:text-5xl font-black uppercase text-foreground mb-4 justify-center text-center"
                                    />
                                    <TypewriterParagraph
                                        text="Watch how we transform ideas into high-performance digital products."
                                        as="p"
                                        className="text-muted-foreground text-lg mt-4 max-w-xl mx-auto text-center"
                                    />
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
                <div className="relative z-10 w-full max-w-[1400px] mx-auto">
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

            {/* Panel 5 (Terminal): CTA Section (Open Space Showcase) */}
            <PinnedPanel id="cta" isLast={true} className="min-h-[85vh] flex items-center justify-center">
                <div className="relative z-10 w-full">
                    <CTAScrollScale />
                </div>
            </PinnedPanel>
        </PinnedPanelsLayout>
    );
}
