"use client";

import { TypewriterEffect } from "@/components/ui/typewriter-effect";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
    text: string;
    className?: string;
}

export function SectionHeading({ text, className }: SectionHeadingProps) {
    const words = text.split(" ").map((word) => ({
        text: word,
        className: "text-white dark:text-white",
    }));

    return (
        <TypewriterEffect
            words={words}
            className={cn("font-bold text-center justify-center", className)}
            cursorClassName="hidden"
            speed={0.04}
        />
    );
}
