"use client";

import { Box } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as Icons from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────────────────────────────

const TILT_MAX = 9;
const TILT_SPRING = { stiffness: 300, damping: 28 } as const;
const GLOW_SPRING = { stiffness: 180, damping: 22 } as const;

// ─── Service color palette (cycles through for each card) ─────────────────────

const COLOR_PALETTE = [
    "#39ff14", // neon green (brand primary)
    "#60a5fa", // blue
    "#f472b6", // pink
    "#f59e0b", // amber
    "#a78bfa", // violet
    "#38bdf8", // sky
];

// ─── Single Card ─────────────────────────────────────────────────────────────────

interface SpotlightServiceCardProps {
    iconName: string;
    title: string;
    description: string;
    color: string;
    dimmed: boolean;
    onHoverStart: () => void;
    onHoverEnd: () => void;
}

export function SpotlightServiceCard({
    iconName,
    title,
    description,
    color,
    dimmed,
    onHoverStart,
    onHoverEnd,
}: SpotlightServiceCardProps) {
    // Safe dynamic icon lookup — narrows to component only if it's a function
    const lookedUp = (Icons as Record<string, unknown>)[iconName];
    const Icon: LucideIcon = (typeof lookedUp === "function" ? lookedUp : Box) as LucideIcon;
    const cardRef = useRef<HTMLDivElement>(null);

    const normX = useMotionValue(0.5);
    const normY = useMotionValue(0.5);

    const rawRotateX = useTransform(normY, [0, 1], [TILT_MAX, -TILT_MAX]);
    const rawRotateY = useTransform(normX, [0, 1], [-TILT_MAX, TILT_MAX]);

    const rotateX = useSpring(rawRotateX, TILT_SPRING);
    const rotateY = useSpring(rawRotateY, TILT_SPRING);
    const glowOpacity = useSpring(0, GLOW_SPRING);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = cardRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        normX.set((e.clientX - rect.left) / rect.width);
        normY.set((e.clientY - rect.top) / rect.height);
    };

    const handleMouseEnter = () => {
        glowOpacity.set(1);
        onHoverStart();
    };

    const handleMouseLeave = () => {
        normX.set(0.5);
        normY.set(0.5);
        glowOpacity.set(0);
        onHoverEnd();
    };

    return (
        <motion.div
            animate={{
                scale: dimmed ? 0.96 : 1,
                opacity: dimmed ? 0.45 : 1,
            }}
            className={cn(
                "group relative flex flex-col gap-5 overflow-hidden rounded-2xl border p-6 h-full",
                // Dark-first (your site is dark)
                "border-white/8 bg-white/3 shadow-none",
                "transition-[border-color] duration-300",
                "hover:border-white/20"
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
            ref={cardRef}
            style={{
                rotateX,
                rotateY,
                transformPerspective: 900,
            }}
            transition={{ duration: 0.18, ease: "easeOut" }}
        >
            {/* Static accent tint */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                    background: `radial-gradient(ellipse at 20% 20%, ${color}1a, transparent 65%)`,
                }}
            />

            {/* Hover glow */}
            <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                    opacity: glowOpacity,
                    background: `radial-gradient(ellipse at 20% 20%, ${color}33, transparent 65%)`,
                }}
            />

            {/* Shimmer sweep */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-[55%] -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[280%]"
            />

            {/* Icon badge */}
            <div
                className="relative z-10 flex h-11 w-11 items-center justify-center rounded-xl"
                style={{
                    background: `${color}18`,
                    boxShadow: `inset 0 0 0 1px ${color}40`,
                }}
            >
                <Icon size={18} strokeWidth={1.8} style={{ color }} />
            </div>

            {/* Text */}
            <div className="relative z-10 flex flex-col gap-2">
                <h3 className="font-semibold text-[15px] text-white tracking-tight">
                    {title}
                </h3>
                <p className="text-[13px] text-white/45 leading-relaxed">
                    {description}
                </p>
            </div>

            {/* Accent bottom line */}
            <div
                aria-hidden="true"
                className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full transition-all duration-500 group-hover:w-full"
                style={{
                    background: `linear-gradient(to right, ${color}90, transparent)`,
                }}
            />
        </motion.div>
    );
}

// ─── Grid wrapper (client, manages hover state) ──────────────────────────────────

interface SpotlightServicesGridProps {
    services: {
        id: string;
        title: string;
        description: string | null;
        iconName: string;
        colorIndex: number;
    }[];
}

export function SpotlightServicesGrid({ services }: SpotlightServicesGridProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
                <SpotlightServiceCard
                    key={service.id}
                    iconName={service.iconName}
                    title={service.title}
                    description={service.description ?? ""}
                    color={COLOR_PALETTE[service.colorIndex % COLOR_PALETTE.length]}
                    dimmed={hoveredId !== null && hoveredId !== service.id}
                    onHoverStart={() => setHoveredId(service.id)}
                    onHoverEnd={() => setHoveredId(null)}
                />
            ))}
        </div>
    );
}
