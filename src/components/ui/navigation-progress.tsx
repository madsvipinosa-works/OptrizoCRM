"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Complete progress on route change
  useEffect(() => {
    if (loading) {
      setProgress(100);
      const timer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Intercept client route navigation clicks
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignore external links, downloads, anchors, new tabs, and modifier keys
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.hasAttribute("download") ||
        target.target === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        e.defaultPrevented
      ) {
        return;
      }

      // Check if clicking link to the current exact route
      const currentUrl = window.location.pathname + window.location.search;
      if (href === currentUrl || href === window.location.pathname) {
        return;
      }

      setLoading(true);
      setProgress(30);
    };

    document.addEventListener("click", handleAnchorClick, true);
    return () => {
      document.removeEventListener("click", handleAnchorClick, true);
    };
  }, []);

  // Trickle effect while loading
  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        const remaining = 90 - prev;
        return prev + Math.max(remaining * 0.12, 1.5);
      });
    }, 150);

    return () => clearInterval(interval);
  }, [loading]);

  if (!loading && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-[3px] bg-transparent overflow-hidden"
      role="progressbar"
      aria-label="Navigation progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      <div
        className="h-full bg-gradient-to-r from-emerald-500 via-primary to-teal-300 shadow-[0_0_12px_rgba(0,214,57,0.9)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transitionProperty: "width, opacity",
          transitionDuration: progress === 100 ? "300ms" : "150ms",
          transitionTimingFunction: "ease-out",
        }}
      />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBar />
    </Suspense>
  );
}
