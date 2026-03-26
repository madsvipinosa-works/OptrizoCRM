"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { TypewriterEffect } from "@/components/ui/typewriter-effect";
import IsoLevelWarp from "@/components/ui/isometric-wave-grid-background";
import SlideTextButton from "@/components/ui/slide-text-button";

interface HeroSectionProps {
    title: string;
    description: string;
}

export function HeroSection({ title, description }: HeroSectionProps) {
    // Parse title into words for the typewriter
    const words = title.split(" ").map(word => ({
        text: word,
        className: "text-white dark:text-white"
    }));

    return (
        <section className="relative pt-32 pb-10 md:pt-48 md:pb-12 overflow-hidden min-h-[85vh] flex items-center justify-center">
            {/* Isometric wave grid background */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <IsoLevelWarp
                    color="57, 255, 20"
                    density={50}
                    speed={0.8}
                    className="opacity-40"
                />
            </div>

            {/* Bottom fade overlay — smoothly hides the hard cutoff edge of the glow and grid */}
            <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black to-transparent pointer-events-none z-[1]" />

            {/* Dynamic Background Glow */}
            <motion.div
                animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.5, 0.3]
                }}
                transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen"
            />
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

            <div className="container px-4 mx-auto text-center relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Badge variant="outline" className="mb-8 px-6 py-2 border-primary/20 bg-primary/10 text-primary text-sm backdrop-blur-md hover:bg-primary/20 transition-all cursor-default">
                        <motion.span
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 0.5, delay: 2, repeat: Infinity, repeatDelay: 5 }}
                            className="mr-2 inline-block"
                        >🚀</motion.span>
                        Accelerate Your Digital Transformation
                    </Badge>
                </motion.div>

                <div className="mb-8 min-h-[80px] md:min-h-[120px]">
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter">
                        <TypewriterEffect
                            words={words}
                            cursorClassName="bg-primary"
                            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-center"
                        />
                    </h1>
                </div>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 1.5 }}
                    className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
                >
                    {description}
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 2 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                    <SlideTextButton
                        href="/contact"
                        text="Start Your Project"
                        hoverText="Let's Talk →"
                        variant="default"
                    />
                    <SlideTextButton
                        href="/projects"
                        text="View Our Work"
                        hoverText="See Projects"
                        variant="ghost"
                    />
                </motion.div>
            </div>
        </section>
    );
}
