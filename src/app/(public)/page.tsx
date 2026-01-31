import Link from "next/link";
import { ArrowRight, Code2, Globe, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { getSiteSettings } from "@/features/cms/actions";
import { ServicesGrid } from "@/components/ServicesGrid";
import { TestimonialsGrid } from "@/components/TestimonialsGrid";
import { BlogTeaserGrid } from "@/components/BlogTeaserGrid";

export default async function Home() {
    const settings = await getSiteSettings();

    return (
        <div className="flex flex-col gap-24 pb-24">
            {/* Hero Section */}
            <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
                {/* Background Elements */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/10 blur-[130px] rounded-full pointer-events-none opacity-40 mix-blend-screen" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

                <div className="container px-4 mx-auto text-center relative z-10">
                    <Badge variant="outline" className="mb-6 px-4 py-1.5 border-primary/20 bg-primary/5 text-primary animate-in fade-in zoom-in duration-500">
                        <span className="mr-2">🚀</span> Accelerate Your Digital Transformation
                    </Badge>

                    <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-8 bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent animate-in slide-in-from-bottom-4 duration-700">
                        {settings?.heroTitle || "Build the Future"}
                    </h1>

                    <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed animate-in slide-in-from-bottom-5 duration-700 delay-150">
                        {settings?.heroDescription || "Premium software development agency crafting high-performance websites, complex web apps, and scalable digital solutions."}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in slide-in-from-bottom-6 duration-700 delay-300">
                        <Button asChild size="lg" className="h-14 px-8 text-lg bg-primary text-black hover:bg-primary/90 hover:box-glow transition-all">
                            <Link href="/contact">
                                Start Your Project <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="lg" className="h-14 px-8 text-lg border-white/20 hover:bg-white/5">
                            <Link href="/projects">View Our Work</Link>
                        </Button>
                    </div>
                </div>
            </section>

            {/* About / Mission Section */}
            <section className="container px-4 mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="relative">
                        <div className="absolute -inset-4 bg-primary/20 blur-xl rounded-full opacity-20" />
                        <div className="relative border border-white/10 bg-black/50 backdrop-blur-sm p-8 rounded-2xl">
                            <h3 className="text-2xl font-bold mb-4 text-white">Engineering Excellence</h3>
                            <p className="text-muted-foreground mb-6">
                                {settings?.aboutText || "At Optrizo, we don't just write code. We engineer solutions that solve complex business problems. We're a premium digital agency that builds high-converting websites and applications. We specialize in modern design, performance, and scalability."}
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
            </section>


            {/* Services Section (Dynamic) */}
            <section className="container px-4 mx-auto">
                <div className="flex flex-col items-center mb-16 text-center">
                    <Badge variant="secondary" className="mb-4 text-primary">Our Expertise</Badge>
                    <h2 className="text-4xl font-bold mb-4">End-to-End Digital Solutions</h2>
                    <p className="text-muted-foreground max-w-2xl">We don&apos;t just write code; we build digital assets that drive growth.</p>
                </div>

                <ServicesGrid />
            </section>

            {/* Testimonials Section */}
            <section className="bg-white/5 py-24 border-y border-white/5">
                <div className="container px-4 mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-12">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">Trusted by Market Leaders</h2>
                            <p className="text-muted-foreground">See what our partners are achieving.</p>
                        </div>
                        <Button variant="link" asChild className="text-primary p-0 h-auto font-semibold">
                            <Link href="/testimonials">View all case studies <ArrowRight className="ml-2 h-4 w-4" /></Link>
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <TestimonialsGrid />
                    </div>
                </div>
            </section>

            {/* Blog Teaser Section */}
            <section className="container px-4 mx-auto">
                <div className="flex justify-between items-end mb-12">
                    <div>
                        <Badge variant="secondary" className="mb-4 text-primary">Latest Insights</Badge>
                        <h2 className="text-3xl font-bold">From The Blog</h2>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/blog">View All Articles</Link>
                    </Button>
                </div>
                <BlogTeaserGrid />
            </section>

            {/* CTA Section */}
            <section className="container px-4 mx-auto text-center">
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
            </section>
        </div>
    );
}
