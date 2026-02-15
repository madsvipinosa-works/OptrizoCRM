import Link from "next/link";
import { ArrowRight, Code2, Shield, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { getSiteSettings } from "@/features/cms/actions";
import { HeroSection } from "@/components/public/HeroSection";
import { ServicesGrid } from "@/components/ServicesGrid";
import { TestimonialsGrid } from "@/components/TestimonialsGrid";
import { BlogTeaserGrid } from "@/components/BlogTeaserGrid";

export const revalidate = 3600; // Revalidate every hour

import { ScrollReveal } from "@/components/ui/scroll-reveal";

// ... existing imports

export default async function Home() {
    const settings = await getSiteSettings();

    // Fetch only what's needed or nothing if static
    // (Removed unused parallel fetch)

    return (
        <div className="flex flex-col min-h-screen">
            {/* Animated Hero Section */}
            <HeroSection
                title={settings?.heroTitle || "Build Your Digital Future"}
                description={settings?.heroDescription || "Optrizo is a premium software development agency crafting high-performance websites, complex web apps, and scalable digital solutions."}
            />

            {/* About / Mission Section */}
            <ScrollReveal className="container px-4 mx-auto py-32">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="relative">
                        <div className="absolute -inset-4 bg-primary/20 blur-xl rounded-full opacity-20" />
                        <div className="relative border border-white/10 bg-black/50 backdrop-blur-sm p-8 rounded-2xl">
                            <h3 className="text-2xl font-bold mb-4 text-white">Engineering Excellence</h3>
                            <p className="text-muted-foreground mb-6">
                                At Optrizo, we don&apos;t just write code. We engineer solutions that solve complex business problems. We&apos;re a premium digital agency that builds high-converting websites and applications. We specialize in modern design, performance, and scalability.
                            </p>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-3 text-sm">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Code2 className="h-4 w-4" /></div>
                                    <span>Clean, Maintainable Architecture</span>
                                </li>
                                <li className="flex items-center gap-3 text-sm">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Shield className="h-4 w-4" /></div>
                                    <span>Enterprise-Grade Security</span>
                                </li>
                                <li className="flex items-center gap-3 text-sm">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Globe className="h-4 w-4" /></div>
                                    <span>Global Scalability</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div>
                        <Badge variant="secondary" className="mb-4 text-primary">Our Mission</Badge>
                        <h2 className="text-4xl md:text-5xl font-bold mb-6">Bridging the Gap Between Vision and Reality</h2>
                        <p className="text-lg text-muted-foreground mb-8">
                            We believe that technology should be an enabler, not a bottleneck.
                            Our mission is to empower businesses with digital tools that are as beautiful as they are functional.
                        </p>
                        <Button variant="link" asChild className="text-primary p-0 h-auto text-lg font-semibold group">
                            <Link href="/about">Meet the Team <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></Link>
                        </Button>
                    </div>
                </div>
            </ScrollReveal>


            {/* Services Section (Dynamic) */}
            <section className="container px-4 mx-auto py-32">
                <ScrollReveal className="flex flex-col items-center mb-16 text-center">
                    <Badge variant="secondary" className="mb-4 text-primary">Our Expertise</Badge>
                    <h2 className="text-4xl font-bold mb-4">End-to-End Digital Solutions</h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto">We don&apos;t just write code; we build digital assets that drive growth.</p>
                </ScrollReveal>

                <ServicesGrid />
            </section>

            {/* Testimonials Section */}
            <section className="bg-white/5 py-32 border-y border-white/5">
                <div className="container px-4 mx-auto">
                    <ScrollReveal className="flex flex-col md:flex-row justify-between items-end mb-12">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">Trusted by Market Leaders</h2>
                            <p className="text-muted-foreground">See what our partners are achieving.</p>
                        </div>
                        <Button variant="link" asChild className="text-primary p-0 h-auto font-semibold">
                            <Link href="/testimonials">View all case studies <ArrowRight className="ml-2 h-4 w-4" /></Link>
                        </Button>
                    </ScrollReveal>

                    <div className="w-full">
                        <TestimonialsGrid />
                    </div>
                </div>
            </section>

            {/* Blog Teaser Section */}
            <section className="container px-4 mx-auto py-32">
                <ScrollReveal className="flex justify-between items-end mb-12">
                    <div>
                        <Badge variant="secondary" className="mb-4 text-primary">Latest Insights</Badge>
                        <h2 className="text-3xl font-bold">From The Blog</h2>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/blog">View All Articles</Link>
                    </Button>
                </ScrollReveal>
                <BlogTeaserGrid />
            </section>

            {/* CTA Section */}
            <ScrollReveal variant="zoom" className="container px-4 mx-auto text-center py-32">
                <div className="relative bg-gradient-to-r from-primary/20 via-primary/5 to-transparent p-12 md:p-24 rounded-3xl border border-primary/20 overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />

                    <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white relative z-10">Ready to Scale?</h2>
                    <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto relative z-10">
                        Join hundreds of satisfied clients who have built their digital future with Optrizo.
                    </p>
                    <Button asChild size="lg" className="h-16 px-10 text-xl bg-primary text-black font-bold hover:bg-primary/90 hover:box-glow transition-all relative z-10">
                        <Link href="/contact">Get a Free Consultation</Link>
                    </Button>
                </div>
            </ScrollReveal>
        </div>
    );
}
