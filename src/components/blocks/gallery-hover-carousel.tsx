"use client";

import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

interface GalleryHoverCarouselItem {
    id: string;
    title: string;
    summary: string;
    url: string;
    image: string;
}

export default function GalleryHoverCarousel({
    items = []
}: {
    items?: GalleryHoverCarouselItem[];
}) {
    if (!items || items.length === 0) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {items.map((item, index) => (
                <div key={item.id} className="w-full">
                    <Link href={item.url} className="group block relative w-full h-[460px]">
                        <Card className="relative h-full w-full overflow-hidden rounded-3xl border border-border/80 bg-card hover:border-primary/50 shadow-sm hover:shadow-2xl transition-all duration-500">

                            {/* Image (Starts full height, shrinks to 52% on hover) */}
                            <div className="absolute top-0 left-0 w-full h-full group-hover:h-[52%] transition-all duration-500 ease-in-out z-10 overflow-hidden bg-muted">
                                <Image
                                    fill
                                    src={item.image}
                                    alt={item.title}
                                    className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
                                />

                                {/* Unhovered Bottom Caption Overlay (Smoothly fades out when hovering) */}
                                <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/85 via-black/45 to-transparent transition-opacity duration-300 group-hover:opacity-0 flex flex-col justify-end pointer-events-none">
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#00D639] font-bold mb-1">
                                        INSIGHT // 0{index + 1}
                                    </span>
                                    <h4 className="text-white font-black text-sm sm:text-base leading-snug line-clamp-2 uppercase tracking-tight">
                                        {item.title}
                                    </h4>
                                </div>
                            </div>

                            {/* Text Section (Reveals in the bottom 48% on hover) */}
                            <div className="absolute bottom-0 left-0 w-full h-[48%] p-5 sm:p-6 flex flex-col justify-between translate-y-6 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-out z-20 bg-card border-t border-border/80">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
                                            INSIGHT // 0{index + 1}
                                        </span>
                                    </div>
                                    <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2 leading-snug">
                                        {item.title}
                                    </h3>
                                    <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
                                        {item.summary}
                                    </p>
                                </div>

                                {/* Bottom Action Strip */}
                                <div className="flex items-center justify-between pt-3 border-t border-border/60 mt-auto">
                                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                                        Read Article
                                    </span>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background group-hover:bg-primary group-hover:text-black group-hover:border-primary transition-all duration-300 text-foreground">
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </Link>
                </div>
            ))}
        </div>
    );
}
