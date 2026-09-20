"use client";

import React, { useRef } from "react";
import { useScroll, useTransform, motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Cpu, ShieldCheck, Zap } from "lucide-react";
import { TypewriterHeader, TypewriterParagraph } from "@/components/ui/typewriter-text";

const Optrizo3DLogo = dynamic(() => import("@/components/ui/optrizo-3d-logo"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
    ),
});

export function CTAScrollScale() {
    const containerRef = useRef<HTMLDivElement>(null);
    const shouldReduceMotion = useReducedMotion();

    // Scroll-linked smooth entrance tracking:
    // "start end" = section top enters bottom of viewport
    // "center center" = section center is centered in viewport
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "center center"],
    });

    const shouldAnimate = !shouldReduceMotion;

    // Scroll-driven dynamic entrance transforms for 3D model & text
    const modelY = useTransform(scrollYProgress, [0, 1], [90, 0]);
    const modelScale = useTransform(scrollYProgress, [0, 0.85, 1], [0.88, 1.03, 1]);
    const modelOpacity = useTransform(scrollYProgress, [0, 0.25, 1], [0.15, 0.85, 1]);

    const textY = useTransform(scrollYProgress, [0, 1], [50, 0]);
    const textOpacity = useTransform(scrollYProgress, [0, 0.35, 1], [0.25, 0.9, 1]);

    // Ambient halo expansion linked to scroll
    const glowScale = useTransform(scrollYProgress, [0, 1], [0.75, 1.25]);
    const glowOpacity = useTransform(scrollYProgress, [0, 1], [0.2, 0.55]);

    return (
        <section
            ref={containerRef}
            className="relative w-full overflow-visible py-16 sm:py-24 md:py-28 lg:py-36"
        >
            {/* Subtle ambient cyber dot grid spanning the open section */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.14] dark:opacity-[0.22]"
                style={{
                    backgroundImage: "radial-gradient(circle, rgba(0,214,57,0.25) 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                }}
            />

            {/* Open Showcase Section Layout: Wider container brings text closer to left edge */}
            <div className="relative z-10 w-full max-w-[1440px] xl:max-w-[1560px] mx-auto px-6 sm:px-10 md:px-12 lg:px-16 xl:px-20 flex flex-col-reverse lg:flex-row items-center justify-between gap-10 lg:gap-12 xl:gap-16">
                
                {/* Left Column: Heading, Subtitle, Actions, & 3-Metric Feature Row */}
                <motion.div
                    className="w-full lg:w-[46%] xl:w-[44%] text-left flex flex-col items-start justify-center"
                    style={shouldAnimate ? { y: textY, opacity: textOpacity } : undefined}
                >
                    {/* Optrizo Pulsing Beacon Badge */}
                    <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono tracking-widest uppercase mb-5 sm:mb-6 shadow-xs">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                        </span>
                        <span>OPTRIZO // START YOUR PROJECT</span>
                    </div>

                    {/* Headline: Proportional, impactful 2-line layout with typewriter effect */}
                    <TypewriterHeader
                        as="h2"
                        className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] xl:text-[3.65rem] font-black tracking-tight leading-[1.04] uppercase text-foreground mb-5 block"
                        words={[
                            { text: "Ready to Build" },
                            {
                                text: "Something Great?",
                                className: "text-primary block mt-1 drop-shadow-[0_0_24px_rgba(0,214,57,0.35)]",
                            },
                        ]}
                    />

                    {/* Subtitle */}
                    <TypewriterParagraph
                        as="p"
                        className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg mb-8 font-normal block"
                        text="Join the ambitious businesses that trust Optrizo to turn complex ideas into high-performance digital products — on time, on budget, and beyond expectation."
                    />

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3.5 sm:gap-4 mb-10 sm:mb-12">
                        <Link
                            href="/contact"
                            className="inline-flex items-center justify-center gap-2.5 px-7 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-primary text-black font-mono text-xs uppercase tracking-wider font-bold hover:bg-primary/90 hover:shadow-[0_0_30px_rgba(0,214,57,0.45)] transition-all duration-300 shadow-sm group"
                        >
                            <span>Get a Free Consultation</span>
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link
                            href="/projects"
                            className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 sm:py-4 rounded-xl border border-border bg-card text-foreground hover:bg-primary hover:text-black font-mono text-xs uppercase tracking-wider font-bold transition-all duration-300 shadow-xs"
                        >
                            <span>Explore Case Studies</span>
                        </Link>
                    </div>

                    {/* 3-Metric Telemetry Row: Structured with circular badge icons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 pt-6 border-t border-border/60 w-full max-w-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full border border-primary/20 bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-xs">
                                <Cpu className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="font-mono text-xs sm:text-sm font-bold uppercase text-foreground">Bespoke</div>
                                <div className="text-[11px] text-muted-foreground">Custom Architecture</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full border border-primary/20 bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-xs">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="font-mono text-xs sm:text-sm font-bold uppercase text-foreground">99.9%</div>
                                <div className="text-[11px] text-muted-foreground">Enterprise Uptime</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full border border-primary/20 bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-xs">
                                <Zap className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="font-mono text-xs sm:text-sm font-bold uppercase text-foreground">Zero</div>
                                <div className="text-[11px] text-muted-foreground">Tech Compromise</div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Right Column: Heroic 3D Interactive Optrizo Logo Model with Equal Visual Weight */}
                <motion.div
                    className="w-full lg:w-[54%] xl:w-[56%] h-[460px] sm:h-[540px] md:h-[620px] lg:h-[680px] xl:h-[740px] relative flex items-center justify-center"
                    style={shouldAnimate ? { y: modelY, scale: modelScale, opacity: modelOpacity } : undefined}
                >
                    {/* Glowing green atmospheric radial bloom centered behind the 3D model */}
                    <motion.div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                        style={shouldAnimate ? { scale: glowScale, opacity: glowOpacity } : undefined}
                    >
                        <div className="w-[450px] sm:w-[560px] lg:w-[680px] h-[450px] sm:h-[560px] lg:h-[680px] rounded-full bg-[radial-gradient(circle_at_center,rgba(0,214,57,0.24)_0%,rgba(0,214,57,0.06)_50%,transparent_72%)] blur-3xl" />
                    </motion.div>

                    <Optrizo3DLogo
                        scale={1.32}
                        scrollProgress={scrollYProgress}
                    />
                </motion.div>
            </div>
        </section>
    );
}
