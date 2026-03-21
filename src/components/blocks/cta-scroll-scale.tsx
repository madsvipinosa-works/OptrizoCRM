"use client";

import React, { useRef } from "react";
import { useScroll, useTransform, motion, useReducedMotion } from "framer-motion";
import SpotlightCard from "@/components/ui/spotlight-card";
import SlideTextButton from "@/components/ui/slide-text-button";

interface CTAScrollScaleProps {
    startScale?: number;
}

export function CTAScrollScale({ startScale = 0.85 }: CTAScrollScaleProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const shouldReduceMotion = useReducedMotion();

    // Use Framer Motion's useScroll targeting the container
    const { scrollYProgress } = useScroll({
        target: containerRef,
        // Start animating when the TOP of the container hits the BOTTOM of the viewport
        // Finish animating when the TOP of the container hits the CENTER of the viewport
        offset: ["start end", "start center"]
    });

    // Map the scroll progress from the startScale to 1.0
    const scale = useTransform(scrollYProgress, [0, 1], [startScale, 1]);

    const shouldAnimate = !shouldReduceMotion;

    return (
        <section ref={containerRef} className="relative container px-4 mx-auto py-32 text-center overflow-hidden">
            <motion.div
                className="relative z-10 will-change-transform flex"
                style={shouldAnimate ? { scale, transformOrigin: "center center" } : undefined}
            >
                <SpotlightCard
                    spotlightColor="rgba(57, 255, 20, 0.12)"
                    className="!bg-white/3 !border-white/10 !rounded-xl !py-16 md:!py-24 !px-8 md:!px-32 w-full max-w-[1200px] mx-auto min-h-[400px] flex flex-col justify-center text-center"
                >
                    {/* Subtle dot grid */}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-xl opacity-20"
                        style={{
                            backgroundImage: "radial-gradient(circle, rgba(57,255,20,0.15) 1px, transparent 1px)",
                            backgroundSize: "28px 28px",
                        }}
                    />

                    {/* Headline */}
                    <h2 className="text-4xl md:text-5xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight max-w-[900px] mx-auto">
                        Ready to Build{" "}
                        <span className="text-primary drop-shadow-[0_0_24px_rgba(57,255,20,0.5)]">
                            Something Great?
                        </span>
                    </h2>
                    <p className="text-xl md:text-2xl text-white/50 max-w-3xl mx-auto mb-12 relative z-10 text-center">
                        Join the businesses that trust Optrizo to turn complex ideas into high-performance digital products — on time, on budget, and beyond expectation.
                    </p>

                    {/* Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 relative z-10 mt-auto">
                        <SlideTextButton
                            href="/contact"
                            text="Get a Free Consultation"
                            hoverText="Let's Talk →"
                            variant="default"
                            className="text-lg px-8 py-6"
                        />
                        <SlideTextButton
                            href="/portfolio"
                            text="See Our Work"
                            hoverText="View Projects"
                            variant="ghost"
                            className="text-lg px-8 py-6 h-[48px]"
                        />
                    </div>
                </SpotlightCard>
            </motion.div>
        </section>
    );
}
