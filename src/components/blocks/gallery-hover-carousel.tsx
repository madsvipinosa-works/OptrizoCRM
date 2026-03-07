"use client";

import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
} from "@/components/ui/carousel";
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
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [itemsCount, setItemsCount] = useState(0);
    // Carousel scroll tracking
    useEffect(() => {
        setItemsCount(items.length);
    }, [items]);

    if (!items || items.length === 0) {
        return null;
    }

    return (
        <div className="w-full max-w-full">
            <Carousel className="relative w-full max-w-full">
                <CarouselContent className="hide-scrollbar w-full max-w-full md:ml-4 md:-mr-4">
                    {items.map((item) => (
                        <CarouselItem key={item.id} className="ml-6 md:max-w-[400px]">
                            <Link href={item.url} className="group block relative w-full h-[450px]">
                                <Card className="relative h-full w-full overflow-hidden rounded-[2rem] border border-transparent bg-transparent hover:bg-[#0a0a0a] hover:border-white/5 transition-all duration-500">

                                    {/* Image (Starts full height, shrinks to 55% on hover) */}
                                    <div className="absolute top-0 left-0 w-full h-full group-hover:h-[55%] transition-all duration-500 ease-in-out z-10 overflow-hidden bg-white/5">
                                        <Image
                                            fill
                                            src={item.image}
                                            alt={item.title}
                                            className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
                                        />
                                    </div>

                                    {/* Text Section (Hidden by default, reveals on hover in the bottom 45%) */}
                                    <div className="absolute bottom-0 left-0 w-full h-[45%] p-6 md:p-8 flex flex-col justify-end translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-out z-0 bg-[#0a0a0a]">
                                        <div>
                                            <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-white mb-2">{item.title}</h3>
                                            <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 md:line-clamp-3">
                                                {item.summary}
                                            </p>
                                        </div>

                                        {/* Action Button */}
                                        <div className="absolute bottom-6 right-6">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-transparent group-hover:bg-white/5 transition-colors text-white">
                                                <ArrowRight className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>
        </div>
    );
}
