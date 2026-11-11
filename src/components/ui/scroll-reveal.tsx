"use client";

import { motion, useInView, useReducedMotion, Variants } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface ScrollRevealProps {
    children: React.ReactNode;
    className?: string;
    variant?: "fade" | "slide-up" | "slide-right" | "zoom";
    delay?: number;
    duration?: number;
    staggerChildren?: number;
    once?: boolean;
}

/** Fades (and slides) its content in once it scrolls into view. Classes apply to the content's own box. */
export function ScrollReveal({
    children,
    className,
    variant = "slide-up",
    delay = 0,
    duration = 0.5,
    once = true,
}: ScrollRevealProps) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once, margin: "-10% 0px" });
    const reduce = useReducedMotion();

    // One box, not a wrapper around a wrapper, so spacing classes like `space-y-4` reach the children.
    const variants: Variants = {
        hidden: {
            opacity: 0,
            y: !reduce && variant === "slide-up" ? 40 : 0,
            x: !reduce && variant === "slide-right" ? -40 : 0,
            scale: !reduce && variant === "zoom" ? 0.95 : 1,
        },
        visible: { opacity: 1, y: 0, x: 0, scale: 1, transition: { duration, delay, ease: [0.25, 0.1, 0.25, 1.0] } },
    };

    return (
        <motion.div ref={ref} variants={variants} initial="hidden" animate={isInView ? "visible" : "hidden"} className={cn(className)}>
            {children}
        </motion.div>
    );
}

export const RevealList = ({
    children,
    className,
    stagger = 0.1,
    delay = 0
}: {
    children: React.ReactNode;
    className?: string;
    stagger?: number;
    delay?: number;
}) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

    return (
        <motion.div
            ref={ref}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={{
                hidden: {},
                visible: { transition: { staggerChildren: stagger, delayChildren: delay } }
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

export const RevealItem = ({
    children,
    className,
    variant = "fade-slide"
}: {
    children: React.ReactNode;
    className?: string;
    variant?: "fade-slide" | "scale";
}) => {
    const variants: Record<string, Variants> = {
        "fade-slide": {
            hidden: { opacity: 0, y: 20 },
            visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }
            }
        },
        "scale": {
            hidden: { opacity: 0, scale: 0.8, y: 20 },
            visible: {
                opacity: 1,
                scale: 1,
                y: 0,
                transition: {
                    type: "spring",
                    stiffness: 100,
                    damping: 20,
                    mass: 1
                }
            }
        }
    };

    return (
        <motion.div
            variants={variants[variant]}
            className={className}
        >
            {children}
        </motion.div>
    );
};
