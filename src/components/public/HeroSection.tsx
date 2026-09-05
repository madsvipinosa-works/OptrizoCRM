"use client";

import React from "react";
import { ExperienceHero } from "@/components/ui/experience-hero";

interface HeroSectionProps {
    title?: string;
    titleLine1?: string;
    titleLine2?: string;
    typewriterWords?: string[];
    taglineBold?: string;
    description?: string;
    badgeText?: string;
    ctaText?: string;
    ctaHref?: string;
}

export function HeroSection({
    title,
    titleLine1 = "OPTRIZO",
    typewriterWords = [
        "CUSTOM SOLUTIONS",
        "DIGITAL PLATFORMS",
        "WEB INNOVATION",
        "SCALABLE SYSTEMS",
    ],
    taglineBold = "POWERED BY INNOVATION.",
    description = "We engineer bespoke web platforms, enterprise software, and scalable digital infrastructure through modern architecture.",
    badgeText = "OPTRIZO // CUSTOM SOLUTIONS",
    ctaText = "Start a Project",
    ctaHref = "/contact",
}: HeroSectionProps) {
    let line1 = titleLine1;

    if (title) {
        if (title.includes("//")) {
            const parts = title.split("//").map((s) => s.trim());
            line1 = parts[0];
        } else {
            const words = title.trim().split(/\s+/);
            if (words.length > 0) {
                line1 = words[0];
            }
        }
    }

    return (
        <div className="relative w-full overflow-hidden">
            <ExperienceHero
                badgeText={badgeText}
                titleLine1={line1}
                typewriterWords={typewriterWords}
                taglineBold={taglineBold}
                description={description}
                ctaText={ctaText}
                ctaHref={ctaHref}
                stats={[
                    { id: "001", title: "AVAILABILITY", val: "Open", type: "progress" },
                    {
                        id: "002",
                        title: "STUDIO STATS",
                        val: "50+ Shipped",
                        type: "data",
                        subtext1: "Client NPS",
                        subtext2: "System Uptime",
                    },
                    {
                        id: "003",
                        title: "EXPERTISE",
                        val: "Custom Solutions",
                        type: "text",
                        text: "Transforming complex business logic into high-velocity digital assets.",
                    },
                ]}
            />
            {/* Bento ambient grid mask */}
            <div className="pointer-events-none absolute inset-0 bento-mask opacity-15 z-[5]" />

            {/* Seamless Bottom Transition Gradient: dissolves bento mask and canvas into the page background */}
            <div
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 md:h-56 bg-gradient-to-t from-background via-background/70 to-transparent z-[6]"
                aria-hidden="true"
            />
        </div>
    );
}

export default HeroSection;
