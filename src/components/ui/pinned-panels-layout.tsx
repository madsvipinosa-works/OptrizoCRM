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
        let timelines: gsap.core.Timeline[] = [];

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

          // Metrics cache to avoid layout thrashing during GSAP scroll callbacks
          const panelMetrics = new Map<HTMLElement, { difference: number; dwellDistance: number }>();

          // Function to update panel margins without layout thrashing (batch reads then writes)
          const applyPanelMetrics = () => {
            const windowHeight = window.innerHeight;
            // 1. Batch all DOM measurements (READ phase)
            const updates = panels.map((panel) => {
              const inner = panel.querySelector(".pinned-panel-inner") as HTMLElement | null;
              if (!inner) return null;
              const panelHeight = inner.offsetHeight;
              const difference = Math.max(0, panelHeight - windowHeight);
              const dwellDistance = Math.round(Math.max(windowHeight * 0.45, 340));
              panelMetrics.set(panel, { difference, dwellDistance });
              return { panel, marginBottom: `${difference + dwellDistance}px` };
            });

            // 2. Batch all DOM style mutations (WRITE phase)
            updates.forEach((item) => {
              if (item) {
                item.panel.style.marginBottom = item.marginBottom;
              }
            });
          };

          // Apply initial margins
          applyPanelMetrics();

          refreshListener = applyPanelMetrics;
          ScrollTrigger.addEventListener("refreshInit", applyPanelMetrics);

          panels.forEach((panel) => {
            const inner = panel.querySelector(".pinned-panel-inner") as HTMLElement | null;
            if (!inner) return;

            const initialMetrics = panelMetrics.get(panel) || { difference: 0, dwellDistance: 0 };
            const windowHeight = window.innerHeight;
            const transitionDistance = windowHeight;

            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: panel,
                start: "bottom bottom",
                end: () => {
                  const m = panelMetrics.get(panel);
                  const diff = m ? m.difference : 0;
                  const dwell = m ? m.dwellDistance : Math.round(Math.max(window.innerHeight * 0.45, 340));
                  return `+=${diff + dwell + window.innerHeight}`;
                },
                pinSpacing: false,
                pin: true,
                scrub: 0.5,
                invalidateOnRefresh: true,
              },
            });

            timelines.push(tl);

            if (initialMetrics.difference > 0) {
              tl.to(inner, {
                y: () => {
                  const m = panelMetrics.get(panel);
                  return -(m ? m.difference : 0);
                },
                duration: initialMetrics.difference,
                ease: "none",
              });
            }

            if (initialMetrics.dwellDistance > 0) {
              tl.to({}, { duration: initialMetrics.dwellDistance });
            }

            // One continuous exit while the next panel slides over (it used to fade to 0.35, then snap to 0).
            // Keep it ONE tween: two overlapping fromTo tweens on the panel broke the order after a window resize.
            const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            tl.fromTo(
              panel,
              { scale: 1, opacity: 1 },
              { scale: reduceMotion ? 1 : 0.88, opacity: 0, duration: transitionDistance, ease: "power1.inOut" }
            );
          });

          ScrollTrigger.refresh();
        };

        const teardown = () => {
          if (refreshListener) {
            ScrollTrigger.removeEventListener("refreshInit", refreshListener);
            refreshListener = null;
          }
          timelines.forEach((tl) => {
            tl.scrollTrigger?.kill(true);
            tl.kill();
          });
          timelines = [];
          panels.forEach((panel) => {
            panel.style.marginBottom = "";
            const inner = panel.querySelector(".pinned-panel-inner") as HTMLElement | null;
            if (inner) {
              gsap.set(inner, { clearProps: "transform" });
            }
            gsap.set(panel, { clearProps: "transform,opacity" });
          });
        };

        // Timeline lengths are measured at the current window size, so rebuild them once a resize settles;
        // refreshing alone left the panels fading out of order after the window was resized.
        const rebuild = () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            teardown();
            initPanels();
          }, 250);
        };
        let lastSize = `${window.innerWidth}x${window.innerHeight}`;
        const onResize = () => {
          const size = `${window.innerWidth}x${window.innerHeight}`;
          if (size === lastSize) return;
          lastSize = size;
          rebuild();
        };

        // Defer until after initial paint so TBT remains near zero
        timer = setTimeout(initPanels, 100);
        window.addEventListener("resize", onResize);

        return () => {
          if (timer) clearTimeout(timer);
          window.removeEventListener("resize", onResize);
          teardown();
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
