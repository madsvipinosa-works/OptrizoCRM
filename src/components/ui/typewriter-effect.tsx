"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/utils";

export const TypewriterEffect = ({
    words,
    className,
    cursorClassName,
}: {
    words: {
        text: string;
        className?: string;
    }[];
    className?: string;
    cursorClassName?: string;
}) => {
    // Split words into characters
    const wordsArray = words.map((word) => {
        return {
            ...word,
            text: word.text.split(""),
        };
    });

    // Custom simple typewriter animation
    const containerRef = useRef(null);
    const isInView = useInView(containerRef, { once: true, margin: "0px 0px -100px 0px" });

    const renderWords = () => {
        return (
            <motion.div ref={containerRef} className="inline">
                {wordsArray.map((word, idx) => {
                    return (
                        <div key={`word-${idx}`} className="inline-block mr-2 last:mr-0">
                            {word.text.map((char, index) => (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={isInView ? { opacity: 1 } : {}}
                                    transition={{
                                        duration: 0.01,
                                        delay: idx * 0.2 + index * 0.05, // Stagger logic
                                        ease: "easeInOut",
                                    }}
                                    key={`char-${index}`}
                                    className={cn(`text-white opacity-0 dark:text-white inline-block`, word.className)}
                                >
                                    {char}
                                </motion.span>
                            ))}
                        </div>
                    );
                })}
            </motion.div>
        );
    };

    return (
        <div
            className={cn(
                "font-bold text-center",
                className
            )}
        >
            {renderWords()}
            <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    repeatType: "reverse",
                }}
                className={cn(
                    "inline-block rounded-sm w-[4px] h-8 md:h-12 lg:h-20 bg-primary align-middle ml-1",
                    cursorClassName
                )}
            ></motion.span>
        </div>
    );
};
