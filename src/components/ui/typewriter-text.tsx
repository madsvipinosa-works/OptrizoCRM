"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TypewriterWord {
    text: string;
    className?: string;
}

export interface TypewriterTextProps {
    text?: string;
    words?: TypewriterWord[];
    as?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";
    className?: string;
    cursorClassName?: string;
    speed?: number; // milliseconds per character
    delay?: number; // initial delay in milliseconds once in view
    cursor?: boolean;
    once?: boolean;
}

export function TypewriterText({
    text,
    words,
    as: Tag = "div",
    className,
    cursorClassName,
    speed = 26,
    delay = 120,
    cursor = true,
    once = true,
}: TypewriterTextProps) {
    const containerRef = useRef<HTMLElement>(null);
    const inView = useInView(containerRef, { once, margin: "-40px" });
    const shouldReduceMotion = useReducedMotion();

    const [mounted, setMounted] = useState(false);
    const [displayedCount, setDisplayedCount] = useState(0);
    const [isFinished, setIsFinished] = useState(false);

    // Normalize input into structured items (either plain text or array of styled words)
    const items = useMemo(() => {
        if (words && words.length > 0) return words;
        if (text) return [{ text }];
        return [];
    }, [text, words]);

    // Build structured word & character index mapping
    const { structuredItems, totalChars } = useMemo(() => {
        let globalIndex = 0;
        const mapped = items.map((item, itemIdx) => {
            const splitWords = item.text.split(" ");
            return {
                itemIdx,
                className: item.className,
                words: splitWords.map((wordStr, wordIdx) => {
                    const chars = wordStr.split("").map((char) => ({
                        char,
                        index: globalIndex++,
                    }));
                    const hasTrailingSpace = wordIdx < splitWords.length - 1;
                    const spaceIndex = hasTrailingSpace ? globalIndex++ : null;
                    return {
                        word: wordStr,
                        chars,
                        hasTrailingSpace,
                        spaceIndex,
                    };
                }),
            };
        });
        return { structuredItems: mapped, totalChars: globalIndex };
    }, [items]);

    // Initial mount hydration sync
    useEffect(() => {
        setMounted(true);
    }, []);

    // Typewriter character reveal interval once in view
    useEffect(() => {
        if (!mounted || shouldReduceMotion) {
            setDisplayedCount(totalChars);
            setIsFinished(true);
            return;
        }

        if (!inView) {
            setDisplayedCount(0);
            setIsFinished(false);
            return;
        }

        let timer: NodeJS.Timeout;
        let charIndex = 0;

        const startDelay = setTimeout(() => {
            timer = setInterval(() => {
                charIndex++;
                setDisplayedCount(charIndex);
                if (charIndex >= totalChars) {
                    clearInterval(timer);
                    setTimeout(() => setIsFinished(true), 1200);
                }
            }, speed);
        }, delay);

        return () => {
            clearTimeout(startDelay);
            if (timer) clearInterval(timer);
        };
    }, [inView, mounted, shouldReduceMotion, totalChars, speed, delay]);

    // Compute cursor active index
    const activeIndex = Math.min(displayedCount, totalChars);

    return (
        <Tag
            ref={containerRef as any}
            className={cn(
                "relative select-text",
                Tag === "span" ? "inline-block" : "block",
                className
            )}
        >
            {structuredItems.map((item) => (
                <span key={`item-${item.itemIdx}`} className={item.className}>
                    {item.words.map((wordObj, wIdx) => (
                        <React.Fragment key={`word-${item.itemIdx}-${wIdx}`}>
                            <span className="inline-block whitespace-nowrap">
                                {wordObj.chars.map(({ char, index }) => {
                                    const isRevealed = !mounted || shouldReduceMotion || index < displayedCount;
                                    const isCursorHere =
                                        cursor &&
                                        mounted &&
                                        !shouldReduceMotion &&
                                        !isFinished &&
                                        index === activeIndex - 1;

                                    return (
                                        <React.Fragment key={`c-${index}`}>
                                            <span
                                                className={cn(
                                                    "inline transition-opacity duration-75",
                                                    isRevealed
                                                        ? "opacity-100"
                                                        : "opacity-0 select-none pointer-events-none"
                                                )}
                                            >
                                                {char}
                                            </span>
                                            {isCursorHere && (
                                                <span
                                                    aria-hidden="true"
                                                    className={cn(
                                                        "inline-block w-[2px] md:w-[3px] h-[0.85em] bg-primary ml-[1px] align-middle animate-pulse shadow-[0_0_8px_rgba(0,214,57,0.7)]",
                                                        cursorClassName
                                                    )}
                                                />
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </span>
                            {/* Render Space */}
                            {wordObj.hasTrailingSpace && wordObj.spaceIndex !== null && (
                                <span
                                    className={cn(
                                        "inline transition-opacity duration-75",
                                        !mounted || shouldReduceMotion || wordObj.spaceIndex < displayedCount
                                            ? "opacity-100"
                                            : "opacity-0 select-none pointer-events-none"
                                    )}
                                >
                                    {" "}
                                </span>
                            )}
                        </React.Fragment>
                    ))}
                </span>
            ))}

            {/* Fallback cursor if at start */}
            {cursor && mounted && !shouldReduceMotion && !isFinished && displayedCount === 0 && (
                <span
                    aria-hidden="true"
                    className={cn(
                        "inline-block w-[2px] md:w-[3px] h-[0.85em] bg-primary align-middle animate-pulse shadow-[0_0_8px_rgba(0,214,57,0.7)]",
                        cursorClassName
                    )}
                />
            )}
        </Tag>
    );
}

// Convenient pre-configured wrappers for headers and paragraphs
export function TypewriterHeader({
    text,
    words,
    as = "h2",
    className,
    cursorClassName,
    speed = 28,
    delay = 100,
    cursor = true,
}: TypewriterTextProps) {
    return (
        <TypewriterText
            text={text}
            words={words}
            as={as}
            speed={speed}
            delay={delay}
            cursor={cursor}
            className={cn("block", className)}
            cursorClassName={cursorClassName}
        />
    );
}

export function TypewriterParagraph({
    text,
    words,
    as = "p",
    className,
    cursorClassName,
    speed = 11,
    delay = 200,
    cursor = true,
}: TypewriterTextProps) {
    return (
        <TypewriterText
            text={text}
            words={words}
            as={as}
            speed={speed}
            delay={delay}
            cursor={cursor}
            className={cn("block", className)}
            cursorClassName={cursorClassName}
        />
    );
}

export default TypewriterText;
