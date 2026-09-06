"use client";

import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

export interface Gallery4Item {
  id: string;
  title: string;
  description: string;
  href: string;
  image: string;
  clientName?: string;
  technologies?: string[];
}

export interface Gallery4Props {
  title?: string;
  badge?: string;
  description?: string;
  items?: Gallery4Item[];
  viewAllHref?: string;
  viewAllText?: string;
}

const defaultData: Gallery4Item[] = [
  {
    id: "nexus-logistics",
    title: "Nexus Logistics: Real-Time Fleet Telemetry",
    clientName: "Nexus Global Supply",
    description:
      "Re-architecting a legacy dispatch operations engine into a sub-second reactive telemetry system, scaling to 45,000 active freight units.",
    href: "/projects/nexus-logistics-fleet-telemetry",
    image:
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2670&auto=format&fit=crop",
    technologies: ["Next.js 15", "Kafka", "TimescaleDB", "Tailwind CSS"],
  },
  {
    id: "aura-living",
    title: "Aura Living: Luxury Headless Commerce & 3D Spatial Previews",
    clientName: "Aura Living Scandinavia",
    description:
      "A headless Shopify Plus transformation featuring interactive WebGL 3D spatial previews, driving a 78% boost in mobile checkout completion.",
    href: "/projects/aura-living-headless-commerce",
    image:
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2600&auto=format&fit=crop",
    technologies: ["Next.js", "React Three Fiber", "Three.js", "Shopify"],
  },
  {
    id: "vanguard-health",
    title: "Vanguard Health: HIPAA-Compliant Telehealth Portal",
    clientName: "Vanguard Health Systems",
    description:
      "Zero-trust, HIPAA-compliant patient management platform with integrated WebRTC end-to-end encrypted video consultations.",
    href: "/projects/vanguard-health-patient-portal",
    image:
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=2670&auto=format&fit=crop",
    technologies: ["Next.js", "WebRTC", "PostgreSQL", "AWS GovCloud"],
  },
  {
    id: "finpulse-capital",
    title: "FinPulse Capital: High-Frequency Portfolio & Risk Intelligence",
    clientName: "FinPulse Capital Partners",
    description:
      "Institutional-grade risk modeling suite processing 2.4M transactions daily with real-time portfolio stress testing.",
    href: "/projects/finpulse-capital-risk-intelligence",
    image:
      "https://images.unsplash.com/photo-1642543492481-44e81e3914a7?q=80&w=2670&auto=format&fit=crop",
    technologies: ["Next.js", "FastAPI", "ClickHouse", "D3.js"],
  },
  {
    id: "kinetix-athletic",
    title: "Kinetix Athletic: AI-Powered Biomechanical Video Coaching App",
    clientName: "Kinetix Performance Lab",
    description:
      "Next-generation computer vision web app delivering instant kinematic feedback and rep-tracking for Olympic weightlifters.",
    href: "/projects/kinetix-athletic-ai-coaching",
    image:
      "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=2670&auto=format&fit=crop",
    technologies: ["Next.js", "WebAssembly", "WebGPU", "MediaPipe"],
  },
];

const Gallery4 = ({
  title = "Selected Case Studies",
  badge = "OPTRIZO // SELECTED WORKS",
  description = "Discover how we partner with ambitious companies to build scalable web applications, striking digital experiences, and mission-critical cloud infrastructure.",
  items = defaultData,
  viewAllHref,
  viewAllText = "View All Projects",
}: Gallery4Props) => {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!carouselApi) {
      return;
    }
    const updateSelection = () => {
      setCanScrollPrev(carouselApi.canScrollPrev());
      setCanScrollNext(carouselApi.canScrollNext());
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };
    updateSelection();
    carouselApi.on("select", updateSelection);
    return () => {
      carouselApi.off("select", updateSelection);
    };
  }, [carouselApi]);

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      {/* Background glow consistent with Hero section */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="mb-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-6 md:mb-14">
          <div className="flex flex-col gap-3 max-w-2xl">
            {badge && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 w-fit tracking-widest uppercase">
                <Sparkles className="w-3.5 h-3.5" /> {badge}
              </div>
            )}
            <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl lg:text-5xl text-glow leading-tight">
              {title}
            </h2>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
              {description}
            </p>
          </div>

          {/* Navigation controls */}
          <div className="shrink-0 flex items-center gap-3">
            {viewAllHref && (
              <Button
                variant="outline"
                asChild
                className="border-white/10 bg-black/40 backdrop-blur-md text-white hover:bg-white/10 hover:border-white/20 transition-all text-sm font-medium mr-1"
              >
                <Link href={viewAllHref}>{viewAllText}</Link>
              </Button>
            )}
            <div className="hidden sm:flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  carouselApi?.scrollPrev();
                }}
                disabled={!canScrollPrev}
                className="h-10 w-10 rounded-full border-white/10 bg-black/40 backdrop-blur-md text-white hover:bg-primary hover:text-black hover:border-primary transition-all disabled:opacity-30 disabled:pointer-events-none shadow-lg"
                aria-label="Previous slide"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  carouselApi?.scrollNext();
                }}
                disabled={!canScrollNext}
                className="h-10 w-10 rounded-full border-white/10 bg-black/40 backdrop-blur-md text-white hover:bg-primary hover:text-black hover:border-primary transition-all disabled:opacity-30 disabled:pointer-events-none shadow-lg"
                aria-label="Next slide"
              >
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Carousel Track */}
      <div className="w-full relative z-10">
        <Carousel
          setApi={setCarouselApi}
          opts={{
            align: "start",
            loop: false,
            breakpoints: {
              "(max-width: 768px)": {
                dragFree: true,
              },
            },
          }}
        >
          <CarouselContent className="ml-0 px-4 md:px-8 xl:px-12">
            {items.map((item) => (
              <CarouselItem
                key={item.id}
                className="basis-full sm:basis-[360px] md:basis-[420px] lg:basis-[460px] pl-4 md:pl-6"
              >
                <Link href={item.href} className="group block h-full">
                  <div className="group relative h-full min-h-[30rem] overflow-hidden rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md transition-all duration-500 group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(57,255,20,0.15)] flex flex-col justify-end">
                    {/* Background Image */}
                    <img
                      src={item.image}
                      alt={item.title}
                      className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105 opacity-65 group-hover:opacity-45"
                    />

                    {/* Gradient Overlays consistent with Hero section */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-90" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(57,255,20,0.1)_0%,_transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    {/* Content overlay */}
                    <div className="relative z-10 flex flex-col items-start p-6 md:p-8 text-white">
                      {item.clientName && (
                        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
                          {item.clientName}
                        </div>
                      )}
                      <h3 className="mb-3 text-xl md:text-2xl font-bold tracking-tight text-white group-hover:text-primary transition-colors line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="mb-6 text-sm text-neutral-300/90 line-clamp-3 leading-relaxed">
                        {item.description}
                      </p>

                      {/* Tech badges if present */}
                      {item.technologies && item.technologies.length > 0 && (
                        <div className="mb-6 flex flex-wrap gap-1.5">
                          {item.technologies.slice(0, 3).map((tech, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-[11px] font-mono rounded bg-white/10 text-white/90 border border-white/10"
                            >
                              {tech}
                            </span>
                          ))}
                          {item.technologies.length > 3 && (
                            <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-white/5 text-white/60">
                              +{item.technologies.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="inline-flex items-center text-sm font-semibold text-primary group-hover:text-white transition-colors">
                        Explore Case Study
                        <ArrowRight className="ml-2 size-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Dynamic Pagination Indicators */}
        <div className="mt-10 flex justify-center items-center gap-2">
          {items.map((_, index) => (
            <button
              key={index}
              className={`h-2 transition-all duration-300 rounded-full ${
                currentSlide === index
                  ? "w-8 bg-primary shadow-[0_0_12px_rgba(57,255,20,0.8)]"
                  : "w-2 bg-white/20 hover:bg-white/40"
              }`}
              onClick={() => carouselApi?.scrollTo(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export { Gallery4 };
export default Gallery4;
