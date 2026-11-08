"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

/**
 * Taste "framed sheet": the active tab is a 2px underline on a full-width rule.
 * Emil: the underline slides to the new tab (spring, no bounce); with reduced motion it jumps.
 */
export function PageTabs({ tabs, active }: { tabs: { slug: string; label: string }[]; active: string }) {
    const reduce = useReducedMotion();
    return (
        <nav aria-label="Pages" className="flex gap-6 border-b border-border">
            {tabs.map((tab) => {
                const isActive = tab.slug === active;
                return (
                    <Link
                        key={tab.slug}
                        href={`/dashboard/pages/${tab.slug}`}
                        aria-current={isActive ? "page" : undefined}
                        className={`relative -mb-px rounded-sm pb-3 pt-1 text-sm font-medium outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring ${
                            isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {tab.label}
                        {isActive && (
                            <motion.span
                                layoutId="page-tab-underline"
                                transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.3, bounce: 0 }}
                                className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-deep"
                                aria-hidden="true"
                            />
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
