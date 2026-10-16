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
    cursor = true,
}: TypewriterTextProps) {
    const containerRef = useRef<HTMLElement>(null);

    // Normalize input into structured items (either plain text or array of styled words)
    const items = useMemo(() => {
        if (words && words.length > 0) return words;
        if (text) return [{ text }];
        return [];
    }, [text, words]);

    return (
        <Tag
            ref={containerRef as any}
            className={cn(
                "relative select-text",
                Tag === "span" ? "inline-block" : "block",
                className
            )}
        >
            {items.map((item, itemIdx) => (
                <span key={`item-${itemIdx}`} className={item.className}>
                    {item.text}
                </span>
            ))}
            {cursor && (
                <span
                    aria-hidden="true"
                    className={cn(
                        "inline-block w-[2px] md:w-[3px] h-[0.85em] bg-primary ml-1.5 align-middle animate-pulse shadow-[0_0_8px_rgba(0,214,57,0.7)]",
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
