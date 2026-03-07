"use client"

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const SQRT_5000 = Math.sqrt(5000);

export interface StaggerTestimonialItem {
    id: string;
    name: string;
    role: string | null;
    company: string | null;
    content: string;
    rating: number | null;
    image: string | null;
}

interface TestimonialCardProps {
    position: number;
    testimonial: StaggerTestimonialItem & { tempId: string | number };
    handleMove: (steps: number) => void;
    cardSize: number;
}

const StarRating: React.FC<{ rating: number; isCenter: boolean }> = ({ rating, isCenter }) => (
    <div className="flex gap-0.5 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
            <Star
                key={i}
                className={cn(
                    "h-4 w-4",
                    i < rating
                        ? isCenter ? "fill-white text-white" : "fill-primary text-primary"
                        : isCenter ? "fill-white/20 text-white/20" : "fill-muted text-muted-foreground"
                )}
            />
        ))}
    </div>
);

const TestimonialCard: React.FC<TestimonialCardProps> = ({
    position,
    testimonial,
    handleMove,
    cardSize
}) => {
    const isCenter = position === 0;

    return (
        <div
            onClick={() => handleMove(position)}
            className={cn(
                "absolute left-1/2 top-1/2 cursor-pointer border-2 p-8 transition-all duration-500 ease-in-out",
                isCenter
                    ? "z-10 bg-primary text-primary-foreground border-primary"
                    : "z-0 bg-card text-card-foreground border-border hover:border-primary/50"
            )}
            style={{
                width: cardSize,
                height: cardSize,
                clipPath: `polygon(50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, calc(100% - 50px) 100%, 50px 100%, 0 100%, 0 0)`,
                transform: `
          translate(-50%, -50%) 
          translateX(${(cardSize / 1.5) * position}px)
          translateY(${isCenter ? -65 : position % 2 ? 15 : -15}px)
          rotate(${isCenter ? 0 : position % 2 ? 2.5 : -2.5}deg)
        `,
                boxShadow: isCenter ? "0px 8px 0px 4px hsl(var(--border))" : "0px 0px 0px 0px transparent"
            }}
        >
            <span
                className="absolute block origin-top-right rotate-45 bg-border"
                style={{
                    right: -2,
                    top: 48,
                    width: SQRT_5000,
                    height: 2
                }}
            />

            {/* Stars */}
            <StarRating rating={testimonial.rating ?? 5} isCenter={isCenter} />

            {/* Avatar */}
            {testimonial.image ? (
                <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="mb-4 h-14 w-12 bg-muted object-cover object-top"
                    style={{ boxShadow: "3px 3px 0px hsl(var(--background))" }}
                />
            ) : (
                <div
                    className={cn(
                        "mb-4 h-14 w-12 flex items-center justify-center text-xl font-bold",
                        isCenter ? "bg-white/20 text-white" : "bg-primary/10 text-primary border border-primary/20"
                    )}
                    style={{ boxShadow: "3px 3px 0px hsl(var(--background))" }}
                >
                    {testimonial.name.charAt(0)}
                </div>
            )}

            <h3 className={cn(
                "text-base sm:text-lg font-medium leading-snug line-clamp-4",
                isCenter ? "text-primary-foreground" : "text-foreground"
            )}>
                &ldquo;{testimonial.content}&rdquo;
            </h3>

            <p className={cn(
                "absolute bottom-8 left-8 right-8 text-sm italic truncate",
                isCenter ? "text-primary-foreground/80" : "text-muted-foreground"
            )}>
                – {testimonial.name}{testimonial.role ? `, ${testimonial.role}` : ""}{testimonial.company ? ` @ ${testimonial.company}` : ""}
            </p>
        </div>
    );
};

export const StaggerTestimonials: React.FC<{ items: StaggerTestimonialItem[] }> = ({ items }) => {
    const [cardSize, setCardSize] = useState(365);
    const [list, setList] = useState(items.map((t, i) => ({ ...t, tempId: i })));

    const handleMove = (steps: number) => {
        const newList = [...list];
        if (steps > 0) {
            for (let i = steps; i > 0; i--) {
                const item = newList.shift();
                if (!item) return;
                newList.push({ ...item, tempId: Math.random() });
            }
        } else {
            for (let i = steps; i < 0; i++) {
                const item = newList.pop();
                if (!item) return;
                newList.unshift({ ...item, tempId: Math.random() });
            }
        }
        setList(newList);
    };

    useEffect(() => {
        const updateSize = () => {
            const { matches } = window.matchMedia("(min-width: 640px)");
            setCardSize(matches ? 365 : 290);
        };
        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, []);

    if (!items || items.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
                No testimonials yet.
            </div>
        );
    }

    return (
        <div className="relative w-full overflow-hidden" style={{ height: 600 }}>
            {list.map((testimonial, index) => {
                const position = list.length % 2
                    ? index - (list.length + 1) / 2
                    : index - list.length / 2;
                return (
                    <TestimonialCard
                        key={testimonial.tempId}
                        testimonial={testimonial}
                        handleMove={handleMove}
                        position={position}
                        cardSize={cardSize}
                    />
                );
            })}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 z-20">
                <button
                    onClick={() => handleMove(-1)}
                    className={cn(
                        "flex h-14 w-14 items-center justify-center text-2xl transition-colors",
                        "bg-background border-2 border-border hover:bg-primary hover:text-primary-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    )}
                    aria-label="Previous testimonial"
                >
                    <ChevronLeft />
                </button>
                <button
                    onClick={() => handleMove(1)}
                    className={cn(
                        "flex h-14 w-14 items-center justify-center text-2xl transition-colors",
                        "bg-background border-2 border-border hover:bg-primary hover:text-primary-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    )}
                    aria-label="Next testimonial"
                >
                    <ChevronRight />
                </button>
            </div>
        </div>
    );
};
