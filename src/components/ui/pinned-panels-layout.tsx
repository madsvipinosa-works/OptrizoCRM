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
        let timer: NodeJS.Timeout | null = null;
        let refreshListener: (() => void) | null = null;
        let panels: HTMLElement[] = [];

        const initPanels = () => {
          if (!containerRef.current) return;
          panels = gsap.utils.toArray<HTMLElement>(
            containerRef.current.querySelectorAll("[data-pinned-panel='true']") || []
          );

          if (panels.length === 0) return;

          // Apply stacked z-index automatically (each panel has higher z-index than the previous)
          const allPanels = gsap.utils.toArray<HTMLElement>(
            containerRef.current.querySelectorAll(".pinned-panel") || []
          );
          allPanels.forEach((panel, i) => {
            panel.style.zIndex = `${i + 2}`;
          });

          // Function to update panel margins based on actual content dimensions
          const applyPanelMetrics = () => {
            panels.forEach((panel) => {
              const inner = panel.querySelector(".pinned-panel-inner") as HTMLElement | null;
              if (!inner) return;

              const panelHeight = inner.offsetHeight;
              const windowHeight = window.innerHeight;
              const difference = Math.max(0, panelHeight - windowHeight);
              const dwellDistance = Math.round(Math.max(windowHeight * 0.45, 340));

              panel.style.marginBottom = `${difference + dwellDistance}px`;
            });
          };

          // Apply initial margins
          applyPanelMetrics();

          refreshListener = applyPanelMetrics;
          ScrollTrigger.addEventListener("refreshInit", applyPanelMetrics);

          panels.forEach((panel) => {
            const inner = panel.querySelector(".pinned-panel-inner") as HTMLElement | null;
            if (!inner) return;

            const panelHeight = inner.offsetHeight;
            const windowHeight = window.innerHeight;
            const difference = Math.max(0, panelHeight - windowHeight);
            const dwellDistance = Math.round(Math.max(windowHeight * 0.45, 340));
            const transitionDistance = windowHeight;

            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: panel,
                start: "bottom bottom",
                end: () => {
                  const pHeight = inner.offsetHeight;
                  const wHeight = window.innerHeight;
                  const diff = Math.max(0, pHeight - wHeight);
                  const dwell = Math.round(Math.max(wHeight * 0.45, 340));
                  return `+=${diff + dwell + wHeight}`;
                },
                pinSpacing: false,
                pin: true,
                scrub: 0.5,
                invalidateOnRefresh: true,
              },
            });

            if (difference > 0) {
              tl.to(inner, {
                y: () => -(Math.max(0, inner.offsetHeight - window.innerHeight)),
                duration: difference,
                ease: "none",
              });
            }

            if (dwellDistance > 0) {
              tl.to({}, { duration: dwellDistance });
            }

            tl.fromTo(
              panel,
              { scale: 1, opacity: 1 },
              {
                scale: 0.88,
                opacity: 0.35,
                duration: transitionDistance * 0.9,
                ease: "power1.inOut",
              }
            ).to(panel, { opacity: 0, duration: transitionDistance * 0.1 });
          });

          ScrollTrigger.refresh();
        };

        // Defer until after initial paint so TBT remains near zero
        timer = setTimeout(initPanels, 100);

        return () => {
          if (timer) clearTimeout(timer);
          if (refreshListener) {
            ScrollTrigger.removeEventListener("refreshInit", refreshListener);
          }
          panels.forEach((panel) => {
            panel.style.marginBottom = "";
            const inner = panel.querySelector(".pinned-panel-inner") as HTMLElement | null;
            if (inner) {
              gsap.set(inner, { clearProps: "all" });
            }
            gsap.set(panel, { clearProps: "all" });
          });
        };
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
