"use client";

import { motion, AnimatePresence, useReducedMotion, LayoutGroup } from "framer-motion";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

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

    useEffect(() => {
        if (shouldAnimate) {
            const timer = setTimeout(() => setIsLoaded(true), 100);
            return () => clearTimeout(timer);
        } else {
            setIsLoaded(true);
        }
    }, [shouldAnimate]);

    // Animation variants
    const containerVariants: any = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2,
            }
        }
    };

    const headerVariants: any = {
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

    const statusBarContainerVariants: any = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.3,
            }
        }
    };

    const statusBarVariants: any = {
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

    const cardContainerVariants: any = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.12,
                delayChildren: 0.8,
            }
        }
    };

    const cardVariants: any = {
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
                                className="bg-black/50 border border-white/10 rounded-2xl overflow-hidden transition-colors duration-300 cursor-pointer group hover:border-primary/50"
                                variants={shouldAnimate ? cardVariants : {}}
                                onClick={() => openCard(card)}
                            >
                                {/* Image with gradient overlay */}
                                <motion.div
                                    layoutId={`card-image-${card.id}`}
                                    className="relative h-56 overflow-hidden bg-white/5"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={card.image}
                                        alt={card.title}
                                        className="w-full h-full object-cover transform-gpu group-hover:scale-105 transition-transform duration-700 ease-out"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent"></div>
                                    {card.gradientColors && (
                                        <div className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t ${card.gradientColors[0]} ${card.gradientColors[1]} to-transparent`}></div>
                                    )}


                                    {/* Category and time info */}
                                    <motion.div
                                        className="absolute bottom-4 left-4 text-white"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 25 }}
                                    >
                                        <div className="text-xs mb-1 text-primary uppercase tracking-widest font-bold">
                                            {card.category}
                                        </div>
                                        <div className="text-xs opacity-75">
                                            {card.timeAgo}
                                        </div>
                                    </motion.div>
                                </motion.div>

                                {/* Content */}
                                <motion.div
                                    className="p-6"
                                >
                                    <h3
                                        className="font-bold text-xl leading-tight line-clamp-2 group-hover:text-primary transition-colors"
                                    >
                                        {card.title}
                                    </h3>
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
                                    className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={closeCard}
                                />

                                {/* Expanded Card */}
                                <motion.div
                                    layoutId={`card-${selectedCard.id}`}
                                    className="fixed inset-4 md:inset-12 lg:inset-y-16 lg:inset-x-[15%] bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden z-[100] shadow-2xl flex flex-col"
                                >
                                    {/* Close Button */}
                                    <motion.button
                                        className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black border border-white/10 rounded-full flex items-center justify-center z-10 text-white"
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.2 }}
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={closeCard}
                                    >
                                        <X className="w-5 h-5" />
                                    </motion.button>

                                    <div className="flex-1 overflow-y-auto hide-scrollbar">
                                        {/* Header Image */}
                                        <motion.div
                                            layoutId={`card-image-${selectedCard.id}`}
                                            className="relative h-64 md:h-96"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={selectedCard.image}
                                                alt={selectedCard.title}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#0a0a0a] to-transparent"></div>
                                            {selectedCard.gradientColors && (
                                                <div className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t ${selectedCard.gradientColors[0]} ${selectedCard.gradientColors[1]} to-transparent`}></div>
                                            )}

                                            {/* Image overlay info */}
                                            <div className="absolute bottom-8 left-8 text-white">
                                                <div className="text-sm mb-2 text-primary uppercase tracking-widest font-bold">{selectedCard.category}</div>
                                                <div className="text-sm opacity-75">{selectedCard.timeAgo} • {selectedCard.location}</div>
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
                                                className="text-3xl md:text-5xl font-extrabold mb-10 tracking-tight"
                                            >
                                                {selectedCard.title}
                                            </motion.h1>

                                            <motion.div
                                                className="prose prose-lg prose-invert max-w-none text-muted-foreground"
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
