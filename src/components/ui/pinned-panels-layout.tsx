"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";

interface PinnedPanelsLayoutProps {
  children: React.ReactNode;
  className?: string;
}

interface PinnedPanelProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
  isLast?: boolean;
  hasTopRounding?: boolean;
}

export function PinnedPanel({
  children,
  id,
  className,
  isLast = false,
  hasTopRounding = true,
}: PinnedPanelProps) {
  return (
    <section
      id={id}
      data-pinned-panel={!isLast ? "true" : "last"}
      className={cn(
        "pinned-panel relative w-full overflow-hidden bg-background transition-colors duration-500",
        hasTopRounding &&
          "rounded-t-[2.25rem] md:rounded-t-[3.5rem] border-t border-black/8 dark:border-white/12 shadow-[0_-20px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_-25px_60px_rgba(0,0,0,0.85)]",
        className
      )}
      style={{
        transformOrigin: "center top",
        willChange: "transform, opacity",
      }}
    >
      <div className="pinned-panel-inner w-full relative">
        {children}
      </div>
    </section>
  );
}

export function PinnedPanelsLayout({
  children,
  className,
}: PinnedPanelsLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (typeof window === "undefined" || !containerRef.current) return;

      gsap.registerPlugin(ScrollTrigger);

      // Match media: enable pinned overscroll on desktop & tablet screens (>= 768px)
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        const panels = gsap.utils.toArray<HTMLElement>(
          containerRef.current?.querySelectorAll("[data-pinned-panel='true']") || []
        );

        if (panels.length === 0) return;

        // Apply stacked z-index automatically (each panel has higher z-index than the previous)
        const allPanels = gsap.utils.toArray<HTMLElement>(
          containerRef.current?.querySelectorAll(".pinned-panel") || []
        );
        allPanels.forEach((panel, i) => {
          panel.style.zIndex = `${i + 2}`;
        });

        panels.forEach((panel) => {
          const inner = panel.querySelector(".pinned-panel-inner") as HTMLElement | null;
          if (!inner) return;

          const panelHeight = inner.offsetHeight;
          const windowHeight = window.innerHeight;
          const difference = panelHeight - windowHeight;
          const fakeScrollRatio =
            difference > 0 ? difference / (difference + windowHeight) : 0;

          if (fakeScrollRatio > 0) {
            panel.style.marginBottom = `${panelHeight * fakeScrollRatio}px`;
          } else {
            panel.style.marginBottom = "0px";
          }

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: panel,
              start: "bottom bottom",
              end: () =>
                fakeScrollRatio ? `+=${panelHeight}` : "bottom top",
              pinSpacing: false,
              pin: true,
              scrub: 0.5,
              invalidateOnRefresh: true,
            },
          });

          // If the section is taller than the viewport, scroll through the inner content smoothly first
          if (fakeScrollRatio > 0) {
            tl.to(inner, {
              yPercent: -100,
              y: windowHeight,
              duration: 1 / (1 - fakeScrollRatio) - 1,
              ease: "none",
            });
          }

          // As the next panel slides up, scale down and dim the outgoing panel with 3D depth
          tl.fromTo(
            panel,
            { scale: 1, opacity: 1 },
            {
              scale: 0.88,
              opacity: 0.35,
              duration: 0.9,
              ease: "power1.inOut",
            }
          ).to(panel, { opacity: 0, duration: 0.1 });
        });

        // Refresh triggers once all measurements settle
        const timer = setTimeout(() => {
          ScrollTrigger.refresh();
        }, 600);

        return () => clearTimeout(timer);
      });

      return () => {
        mm.revert();
      };
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full overflow-visible", className)}
    >
      {children}
    </div>
  );
}

export default PinnedPanelsLayout;
