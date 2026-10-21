"use client";

import { motion, AnimatePresence, useReducedMotion, LayoutGroup, Variants } from "framer-motion";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSmoothScroll } from "@/components/providers/SmoothScrollProvider";

export interface NewsCard {
    id: string;
    title: string;
    category: string;
    subcategory: string;
    timeAgo: string;
    location: string;
    image: string;
    gradientColors?: string[];
    content?: string[];
    slug?: string;
    excerpt?: string;
}

export interface StatusBar {
    id: string;
    category: string;
    subcategory: string;
    length: number; // 1-3 for different lengths
    opacity: number; // 0.3-1 for different opacities
}

interface NewsCardsProps {
    title?: string;
    subtitle?: string;
    statusBars?: StatusBar[];
    newsCards?: NewsCard[];
    enableAnimations?: boolean;
}

export function NewsCards({
    title = "Our Work",
    subtitle = "Selected Case Studies",
    statusBars = [],
    newsCards = [],
    enableAnimations = true,
}: NewsCardsProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [selectedCard, setSelectedCard] = useState<NewsCard | null>(null);
    const shouldReduceMotion = useReducedMotion();
    const shouldAnimate = enableAnimations && !shouldReduceMotion;

    const openCard = (card: NewsCard) => {
        setSelectedCard(card);
    };

    const closeCard = () => {
        setSelectedCard(null);
    };

    const { lenis } = useSmoothScroll();

    useEffect(() => {
        if (!selectedCard) return;

        lenis?.stop();
        const prevOverflow = document.body.style.overflow;
        const prevPaddingRight = document.body.style.paddingRight;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
        document.body.style.overflow = "hidden";

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setSelectedCard(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = prevOverflow;
            document.body.style.paddingRight = prevPaddingRight;
            lenis?.start();
        };
    }, [selectedCard, lenis]);

    useEffect(() => {
        if (shouldAnimate) {
            const timer = setTimeout(() => setIsLoaded(true), 100);
            return () => clearTimeout(timer);
        } else {
            const timer = setTimeout(() => setIsLoaded(true), 0);
            return () => clearTimeout(timer);
        }
    }, [shouldAnimate]);

    // Animation variants
    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2,
            }
        }
    };

    const headerVariants: Variants = {
        hidden: {
            opacity: 0,
            y: -20,
            scale: 0.95,
            filter: "blur(4px)",
        },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            transition: {
                type: "spring",
                stiffness: 400,
                damping: 28,
                mass: 0.6,
            }
        }
    };

    const statusBarContainerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.3,
            }
        }
    };

    const statusBarVariants: Variants = {
        hidden: {
            opacity: 0,
            scaleX: 0,
            x: -20,
        },
        visible: {
            opacity: 1,
            scaleX: 1,
            x: 0,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 25,
                scaleX: { type: "spring", stiffness: 400, damping: 30 }
            }
        }
    };

    const cardContainerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.12,
                delayChildren: 0.8,
            }
        }
    };

    const cardVariants: Variants = {
        hidden: {
            opacity: 0,
            y: 30,
            scale: 0.9,
            filter: "blur(6px)",
        },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 28,
                mass: 0.8,
            }
        }
    };

    return (
        <motion.div
            className="w-full max-w-6xl mx-auto py-24 bg-transparent text-foreground"
            initial={shouldAnimate ? "hidden" : "visible"}
            animate={isLoaded ? "visible" : "hidden"}
            variants={shouldAnimate ? containerVariants : {}}
        >
            {/* Header */}
            <motion.div
                className="mb-16 text-center max-w-2xl mx-auto"
                variants={shouldAnimate ? headerVariants : {}}
            >
                <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">{title}</h1>
                <p className="text-muted-foreground text-lg">{subtitle}</p>

                {/* Simple Border Lines */}
                {statusBars && statusBars.length > 0 && (
                    <motion.div
                        className="mt-6 flex gap-2 justify-center"
                        variants={shouldAnimate ? statusBarContainerVariants : {}}
                    >
                        {statusBars.map((bar, index) => (
                            <motion.div
                                key={bar.id}
                                className={cn("h-1 bg-primary rounded-full")}
                                style={{
                                    opacity: bar.opacity,
                                    width: `${(bar.length / 3) * 100}px`
                                }}
                                variants={shouldAnimate ? statusBarVariants : {}}
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{
                                    delay: 0.3 + (index * 0.1),
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 30
                                }}
                            />
                        ))}
                    </motion.div>
                )}
            </motion.div>

            {/* News Cards with Shared Layout */}
            <LayoutGroup>
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8"
                    variants={shouldAnimate ? cardContainerVariants : {}}
                >
                    {newsCards.map((card) => {
                        if (selectedCard?.id === card.id) {
                            return null; // Don't render the compact card when expanded
                        }

                        return (
                            <motion.article
                                key={card.id}
                                layoutId={`card-${card.id}`}
                                className="bg-card text-card-foreground border border-border hover:border-primary/50 rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer group shadow-xs hover:shadow-xl flex flex-col"
                                variants={shouldAnimate ? cardVariants : {}}
                                onClick={() => openCard(card)}
                            >
                                {/* Image with gradient overlay */}
                                <motion.div
                                    layoutId={`card-image-${card.id}`}
                                    className="relative h-56 overflow-hidden bg-muted"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={card.image}
                                        alt={card.title}
                                        className="w-full h-full object-cover transform-gpu group-hover:scale-105 transition-transform duration-700 ease-out"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                                    {card.gradientColors && (
                                        <div className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t ${card.gradientColors[0]} ${card.gradientColors[1]} to-transparent opacity-40`}></div>
                                    )}

                                    {/* Category and time info */}
                                    <motion.div
                                        className="absolute bottom-4 left-4 text-white z-10"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 25 }}
                                    >
                                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[10px] font-mono text-[#00D639] uppercase tracking-widest font-bold mb-1.5 shadow-xs">
                                            {card.category}
                                        </div>
                                        <div className="text-xs text-white/90 drop-shadow-sm font-medium">
                                            {card.timeAgo}
                                        </div>
                                    </motion.div>
                                </motion.div>

                                {/* Content */}
                                <motion.div
                                    className="p-6 flex-1 flex flex-col justify-between"
                                >
                                    <h3
                                        className="font-bold text-xl leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors"
                                    >
                                        {card.title}
                                    </h3>
                                    {card.excerpt && (
                                        <p className="text-sm text-muted-foreground line-clamp-2 mt-2.5 leading-relaxed">
                                            {card.excerpt}
                                        </p>
                                    )}
                                </motion.div>
                            </motion.article>
                        );
                    })}
                </motion.div>

                {/* Expanded Card Modal via Portal */}
                {isLoaded && typeof document !== "undefined" && createPortal(
                    <AnimatePresence>
                        {selectedCard && (
                            <>
                                {/* Backdrop */}
                                <motion.div
                                    data-lenis-prevent=""
                                    className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md z-[100]"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={closeCard}
                                />

                                {/* Expanded Card */}
                                <motion.div
                                    layoutId={`card-${selectedCard.id}`}
                                    data-lenis-prevent=""
                                    className="fixed inset-4 md:inset-12 lg:inset-y-16 lg:inset-x-[15%] bg-card text-card-foreground border border-border rounded-2xl overflow-hidden z-[100] shadow-2xl flex flex-col"
                                >
                                    {/* Close Button */}
                                    <motion.button
                                        className="absolute top-4 right-4 w-10 h-10 bg-background/80 hover:bg-background border border-border shadow-md rounded-full flex items-center justify-center z-20 text-foreground transition-all duration-200 backdrop-blur-md"
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.2 }}
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={closeCard}
                                        aria-label="Close modal"
                                    >
                                        <X className="w-5 h-5" />
                                    </motion.button>

                                    <div
                                        data-lenis-prevent=""
                                        onWheel={(e) => e.stopPropagation()}
                                        className="flex-1 overflow-y-auto overscroll-contain"
                                    >
                                        {/* Header Image */}
                                        <motion.div
                                            layoutId={`card-image-${selectedCard.id}`}
                                            className="relative h-64 md:h-96 bg-muted"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={selectedCard.image}
                                                alt={selectedCard.title}
                                                className="w-full h-full object-cover"
                                            />
                                            {/* Scrim to ensure text on the image is always readable */}
                                            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-card via-card/40 to-transparent pointer-events-none"></div>

                                            {/* Image overlay info */}
                                            <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8 z-10">
                                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-[#00D639] text-xs font-mono font-bold tracking-wider uppercase mb-1.5 shadow-sm">
                                                    {selectedCard.category}
                                                </div>
                                                <div className="text-xs text-white/95 font-medium drop-shadow-md px-0.5">
                                                    {selectedCard.timeAgo} • {selectedCard.location}
                                                </div>
                                            </div>
                                        </motion.div>

                                        {/* Content */}
                                        <motion.div
                                            className="p-8 md:p-12 max-w-4xl mx-auto"
                                        >
                                            <motion.h1
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.2 }}
                                                className="text-3xl md:text-5xl font-black mb-6 tracking-tight text-foreground leading-tight"
                                            >
                                                {selectedCard.title}
                                            </motion.h1>

                                            {selectedCard.excerpt && (
                                                <motion.p
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.25 }}
                                                    className="text-base md:text-lg text-muted-foreground font-medium leading-relaxed mb-8 border-l-2 border-primary pl-4"
                                                >
                                                    {selectedCard.excerpt}
                                                </motion.p>
                                            )}

                                            <motion.div
                                                className="prose prose-lg dark:prose-invert max-w-none text-foreground/85 dark:text-muted-foreground prose-headings:text-foreground prose-headings:font-bold prose-p:leading-relaxed prose-a:text-primary hover:prose-a:underline prose-strong:text-foreground"
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.3, duration: 0.4 }}
                                            >
                                                {selectedCard.content ? (
                                                    selectedCard.content.map((paragraph, index) => (
                                                        <div
                                                            key={index}
                                                            className="mb-6 leading-relaxed"
                                                            dangerouslySetInnerHTML={{ __html: paragraph }}
                                                        />
                                                    ))
                                                ) : (
                                                    <div className="text-center py-12">
                                                        <p className="text-muted-foreground italic">Extended details not available.</p>
                                                    </div>
                                                )}
                                            </motion.div>

                                            {selectedCard.slug && (
                                                <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                                                        <span>ARTICLE //</span>
                                                        <span className="text-foreground font-semibold">{selectedCard.slug}</span>
                                                    </div>
                                                    <Link
                                                        href={`/blog/${selectedCard.slug}`}
                                                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black font-semibold text-xs font-mono uppercase tracking-wider hover:opacity-90 transition-opacity shadow-sm"
                                                    >
                                                        <span>Open Dedicated Article Page</span>
                                                        <ArrowRight className="w-4 h-4" />
                                                    </Link>
                                                </div>
                                            )}
                                        </motion.div>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>,
                    document.body
                )}
            </LayoutGroup>
        </motion.div>
    );
}
