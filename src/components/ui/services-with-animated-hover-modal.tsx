"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ServiceItem {
    id: string;
    title: string;
    description: string;
    category?: string | null;
    image?: string | null;
    color?: string | null;
    link?: string | null;
    icon?: string | null;
    order?: number | null;
}

export interface ServicesHoverModalProps {
    services?: ServiceItem[];
    badgeText?: string;
    heading?: string;
    subheading?: string;
    className?: string;
}

// Fallback high-resolution Unsplash images representing core modern engineering services
const fallbackImages = [
    "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1000&auto=format&fit=crop", // Fullstack code
    "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1000&auto=format&fit=crop", // Cloud infrastructure
    "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=1000&auto=format&fit=crop", // UI/UX Systems
    "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=1000&auto=format&fit=crop", // Mobile apps
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop", // AI & Architecture
    "https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=1000&auto=format&fit=crop", // Security & DevOps
];

const scaleAnimation = {
    initial: { scale: 0, x: "-50%", y: "-50%" },
    enter: {
        scale: 1,
        x: "-50%",
        y: "-50%",
        transition: { duration: 0.35, ease: [0.76, 0, 0.24, 1] as const },
    },
    closed: {
        scale: 0,
        x: "-50%",
        y: "-50%",
        transition: { duration: 0.25, ease: [0.32, 0, 0.67, 0] as const },
    },
};

const MODAL_HEIGHT = 320;

export function ServicesWithAnimatedHoverModal({
    services = [],
    badgeText = "OPTRIZO // CAPABILITIES",
    heading = "End-to-End Digital Solutions",
    subheading = "We engineer bespoke web platforms, enterprise software, and scalable digital infrastructure through modern architecture.",
    className,
}: ServicesHoverModalProps) {
    const [modal, setModal] = useState<{ active: boolean; index: number }>({
        active: false,
        index: 0,
    });
    const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

    const modalContainer = useRef<HTMLDivElement>(null);
    const cursor = useRef<HTMLDivElement>(null);
    const cursorLabel = useRef<HTMLDivElement>(null);
    const hasPositioned = useRef(false);

    // Track cursor with GSAP physics
    useEffect(() => {
        if (!modalContainer.current || !cursor.current || !cursorLabel.current) return;

        const xMoveContainer = gsap.quickTo(modalContainer.current, "left", {
            duration: 0.55,
            ease: "power3",
        });
        const yMoveContainer = gsap.quickTo(modalContainer.current, "top", {
            duration: 0.55,
            ease: "power3",
        });

        const xMoveCursor = gsap.quickTo(cursor.current, "left", {
            duration: 0.35,
            ease: "power3",
        });
        const yMoveCursor = gsap.quickTo(cursor.current, "top", {
            duration: 0.35,
            ease: "power3",
        });

        const xMoveCursorLabel = gsap.quickTo(cursorLabel.current, "left", {
            duration: 0.3,
            ease: "power3",
        });
        const yMoveCursorLabel = gsap.quickTo(cursorLabel.current, "top", {
            duration: 0.3,
            ease: "power3",
        });

        const handleMouseMove = (e: MouseEvent) => {
            const { clientX, clientY } = e;

            // Instant initial position snap so modal doesn't fly across screen from (0,0)
            if (!hasPositioned.current && modalContainer.current && cursor.current && cursorLabel.current) {
                gsap.set([modalContainer.current, cursor.current, cursorLabel.current], {
                    left: clientX,
                    top: clientY,
                });
                hasPositioned.current = true;
            }

            xMoveContainer(clientX);
            yMoveContainer(clientY);
            xMoveCursor(clientX);
            yMoveCursor(clientY);
            xMoveCursorLabel(clientX);
            yMoveCursorLabel(clientY);
        };

        window.addEventListener("mousemove", handleMouseMove, { passive: true });
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    const toggleMobile = (id: string) => {
        setMobileExpanded((prev) => (prev === id ? null : id));
    };

    return (
        <section
            className={cn(
                "relative w-full py-24 md:py-32 overflow-hidden transition-colors duration-500",
                className
            )}
            onMouseLeave={() => setModal({ active: false, index: 0 })}
        >
            <div className="mx-auto max-w-7xl px-6 md:px-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 md:mb-24">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono tracking-widest uppercase mb-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            {badgeText}
                        </div>
                        <h2 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight uppercase text-foreground">
                            {heading}
                        </h2>
                    </div>
                    <p className="max-w-md font-mono text-xs md:text-sm uppercase tracking-wider text-muted-foreground leading-relaxed">
                        {subheading}
                    </p>
                </div>

                {/* Desktop Interactive Typographic List */}
                <div className="hidden md:flex flex-col w-full">
                    {services.map((service, index) => {
                        const href = service.link || "/contact";
                        return (
                            <Link
                                key={service.id}
                                href={href}
                                className="group relative flex w-full items-center justify-between border-t border-border/70 py-10 lg:py-14 px-4 transition-all duration-300 hover:border-primary/50 hover:bg-muted/10 last:border-b"
                                onMouseEnter={() => setModal({ active: true, index })}
                                onMouseLeave={() => setModal({ active: false, index })}
                            >
                                <div className="flex items-baseline gap-6 lg:gap-10">
                                    <span className="font-mono text-xs text-muted-foreground/60 group-hover:text-primary transition-colors">
                                        {(index + 1).toString().padStart(2, "0")}
                                    </span>
                                    <h3 className="m-0 font-bold text-3xl lg:text-5xl tracking-tight uppercase text-foreground group-hover:text-primary transition-all duration-300 group-hover:translate-x-3">
                                        {service.title}
                                    </h3>
                                </div>

                                <div className="flex items-center gap-6">
                                    <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-all duration-300 group-hover:translate-x-2">
                                        {service.category || "Architecture & Systems"}
                                    </span>
                                    <div className="w-10 h-10 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground group-hover:border-primary group-hover:text-primary group-hover:bg-primary/10 transition-all duration-300 group-hover:scale-110">
                                        <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {/* Mobile / Tablet Responsive Fallback */}
                <div className="flex md:hidden flex-col w-full divide-y divide-border/60 border-y border-border/60">
                    {services.map((service, index) => {
                        const isExpanded = mobileExpanded === service.id;
                        const imgSrc = service.image || fallbackImages[index % fallbackImages.length];

                        return (
                            <div key={service.id} className="py-6">
                                <button
                                    onClick={() => toggleMobile(service.id)}
                                    type="button"
                                    className="w-full flex items-center justify-between text-left gap-4"
                                >
                                    <div>
                                        <span className="font-mono text-[10px] text-primary block mb-1">
                                            {(index + 1).toString().padStart(2, "0")}{" // "}{service.category || "Services"}
                                        </span>
                                        <h3 className="text-xl font-bold uppercase tracking-tight text-foreground">
                                            {service.title}
                                        </h3>
                                    </div>
                                    <ArrowUpRight
                                        className={cn(
                                            "w-5 h-5 text-muted-foreground transition-transform duration-300",
                                            isExpanded && "rotate-90 text-primary"
                                        )}
                                    />
                                </button>

                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="overflow-hidden pt-4 space-y-4"
                                        >
                                            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-white/10">
                                                <Image
                                                    src={imgSrc}
                                                    alt={service.title}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <p className="text-sm text-muted-foreground leading-relaxed">
                                                {service.description}
                                            </p>
                                            <Link
                                                href={service.link || "/contact"}
                                                className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-primary pt-2"
                                            >
                                                <span>Start Project</span>
                                                <ArrowUpRight className="w-4 h-4" />
                                            </Link>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Floating Desktop Animated Hover Modal Window */}
            <motion.div
                ref={modalContainer}
                variants={scaleAnimation}
                initial="initial"
                animate={modal.active ? "enter" : "closed"}
                className="hidden md:flex fixed top-0 left-0 pointer-events-none z-40 items-center justify-center overflow-hidden rounded-2xl shadow-2xl border border-white/20 backdrop-blur-xl bg-neutral-950/95"
                style={{
                    width: 440,
                    height: MODAL_HEIGHT,
                }}
            >
                <div
                    className="absolute w-full flex flex-col transition-[top] duration-500 ease-[cubic-bezier(0.76,0,0.24,1)]"
                    style={{
                        top: `-${modal.index * MODAL_HEIGHT}px`,
                    }}
                >
                    {services.map((service, idx) => {
                        const imgSrc = service.image || fallbackImages[idx % fallbackImages.length];
                        const bgColor = service.color || "#05160b";

                        return (
                            <div
                                key={service.id}
                                className="relative flex-shrink-0 flex items-center justify-center p-3.5 overflow-hidden"
                                style={{
                                    width: "100%",
                                    height: `${MODAL_HEIGHT}px`,
                                    backgroundColor: bgColor,
                                }}
                            >
                                <div className="relative w-full h-full rounded-xl overflow-hidden shadow-inner border border-white/10">
                                    <Image
                                        src={imgSrc}
                                        alt={service.title}
                                        fill
                                        sizes="440px"
                                        className="object-cover"
                                        priority={idx === 0}
                                    />
                                    {/* Ambient subtle vignette */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />
                                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                                        <span className="font-mono text-[10px] uppercase tracking-wider text-white/95 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15">
                                            {service.category || "Optrizo"}
                                        </span>
                                        <span className="font-mono text-[10px] font-bold tracking-widest text-[#00D639] bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-primary/20">
                                            {(idx + 1).toString().padStart(2, "0")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </motion.div>

            {/* Custom Electric Green Floating Cursor Pill */}
            <motion.div
                ref={cursor}
                variants={scaleAnimation}
                initial="initial"
                animate={modal.active ? "enter" : "closed"}
                className="hidden md:flex fixed top-0 left-0 pointer-events-none z-50 items-center justify-center rounded-full bg-[#00D639] shadow-[0_0_35px_rgba(0,214,57,0.6)]"
                style={{
                    width: 80,
                    height: 80,
                }}
            />

            {/* Custom Cursor Label */}
            <motion.div
                ref={cursorLabel}
                variants={scaleAnimation}
                initial="initial"
                animate={modal.active ? "enter" : "closed"}
                className="hidden md:flex fixed top-0 left-0 pointer-events-none z-50 items-center justify-center rounded-full font-mono text-[11px] font-black uppercase tracking-widest text-black"
                style={{
                    width: 80,
                    height: 80,
                }}
            >
                View
            </motion.div>
        </section>
    );
}

export const Component = ServicesWithAnimatedHoverModal;
export default ServicesWithAnimatedHoverModal;
