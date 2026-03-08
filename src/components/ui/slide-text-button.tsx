"use client";

/**
 * Slide Text Button — vertical text transition on hover.
 * Adapted from kokonutui.com for framer-motion (project uses framer-motion, not motion/react).
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SlideTextButtonProps
    extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    text?: string;
    hoverText?: string;
    href?: string;
    className?: string;
    variant?: "default" | "ghost";
}

export default function SlideTextButton({
    text = "Get Started",
    hoverText,
    href = "/",
    className,
    variant = "default",
    ...props
}: SlideTextButtonProps) {
    const slideText = hoverText ?? text;

    const variantStyles =
        variant === "ghost"
            ? "border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 hover:border-primary/60"
            : "bg-primary text-black hover:bg-primary/90 hover:shadow-[0_0_32px_rgba(57,255,20,0.45)]";

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
            className="relative"
        >
            <Link
                href={href}
                className={cn(
                    "group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-xl px-8 font-semibold text-base tracking-tight transition-all duration-300 md:min-w-48",
                    variantStyles,
                    className
                )}
                {...props}
            >
                <span className="relative inline-block transition-transform duration-300 ease-in-out group-hover:-translate-y-full">
                    {/* Resting text */}
                    <span className="flex items-center gap-2 opacity-100 transition-opacity duration-300 group-hover:opacity-0">
                        <span className="font-semibold">{text}</span>
                    </span>
                    {/* Hover text slides up from below */}
                    <span className="absolute top-full left-0 flex items-center gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <span className="font-semibold">{slideText}</span>
                    </span>
                </span>
            </Link>
        </motion.div>
    );
}
