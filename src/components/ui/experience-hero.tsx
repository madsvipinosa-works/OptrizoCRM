"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Sun, Moon } from "lucide-react";

const Hero3DScene = dynamic(() => import("./hero-3d-scene"), {
  ssr: false,
  loading: () => null,
});

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// --- Optimized Typewriter Component ---
interface TypewriterProps {
  words: string[];
  typeSpeed?: number;
  deleteSpeed?: number;
  pauseDelay?: number;
  className?: string;
}

export const TypewriterHeadline: React.FC<TypewriterProps> = ({
  words,
  typeSpeed = 80,
  deleteSpeed = 40,
  pauseDelay = 3500,
  className = "",
}) => {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(words && words[0] ? words[0].length : 0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!words || words.length === 0) return;

    if (!hasStarted) {
      const startTimer = setTimeout(() => {
        setHasStarted(true);
        setIsDeleting(true);
      }, pauseDelay);
      return () => clearTimeout(startTimer);
    }

    const currentWord = words[index % words.length];

    if (!isDeleting && subIndex === currentWord.length) {
      const timeout = setTimeout(() => setIsDeleting(true), pauseDelay);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && subIndex === 0) {
      const timeout = setTimeout(() => {
        setIsDeleting(false);
        setIndex((prev) => (prev + 1) % words.length);
      }, 50);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(
      () => {
        setSubIndex((prev) => prev + (isDeleting ? -1 : 1));
      },
      isDeleting ? deleteSpeed : typeSpeed
    );

    return () => clearTimeout(timeout);
  }, [subIndex, index, isDeleting, words, typeSpeed, deleteSpeed, pauseDelay, hasStarted]);

  const currentWord = words[index % words.length] || "";
  const displayedText = currentWord.substring(0, subIndex);

  return (
    <span className={`inline relative ${className}`} suppressHydrationWarning>
      <span className="text-outline will-change-contents" suppressHydrationWarning>
        {displayedText}
      </span>
      <span
        className="inline-block w-[3px] sm:w-[4px] md:w-[6px] h-[0.78em] ml-1.5 bg-[#00D639] animate-pulse align-[-0.04em] shadow-[0_0_12px_#00D639] rounded-[1px]"
        aria-hidden="true"
        suppressHydrationWarning
      />
    </span>
  );
};

export interface ExperienceHeroProps {
  badgeText?: string;
  titleLine1?: string;
  typewriterWords?: string[];
  taglineBold?: string;
  description?: string;
  ctaText?: string;
  ctaHref?: string;
  initialTheme?: "dark" | "light";
  stats?: Array<{
    id: string;
    title: string;
    val?: string;
    type: "progress" | "data" | "text";
    text?: string;
subtext1?: string;
    subtext2?: string;
  }>;
}

// --- WebGL Capability & Error Boundary Safeguards ---
function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext("experimental-webgl", { failIfMajorPerformanceCaveat: false });
    return !!gl;
  } catch {
    return false;
  }
}

interface WebGLErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface WebGLErrorBoundaryState {
  hasError: boolean;
}

export class WebGLErrorBoundary extends React.Component<
  WebGLErrorBoundaryProps,
  WebGLErrorBoundaryState
> {
  constructor(props: WebGLErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): WebGLErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn("WebGL is unavailable in this environment. Falling back to ambient cybernetic graphics:", error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

function HeroCyberFallback({ isDark }: { isDark: boolean }) {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden">
      {/* Ambient Core Radial Glow */}
      <div
        className={`absolute w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full blur-[140px] transition-colors duration-700 ${
          isDark ? "bg-[#00D639]/15" : "bg-[#00D639]/10"
        }`}
      />
      {/* Cybernetic Geometric Monogram Silhouette */}
      <div className="relative w-64 h-64 md:w-80 md:h-80 opacity-40 translate-y-16 md:translate-y-0">
        <svg viewBox="0 0 100 115" fill="none" className="w-full h-full">
          <polygon
            points="50 0, 100 28.8, 100 86.6, 50 115.5, 0 86.6, 0 28.8"
            stroke="#00D639"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            style={{ transformOrigin: "50px 57.75px" }}
          />
          <polygon
            points="50 15, 87 36, 87 79, 50 100, 13 79, 13 36"
            stroke={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"}
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  );
}

export const ExperienceHero: React.FC<ExperienceHeroProps> = ({
  badgeText = "OPTRIZO // ARCHITECTURE & SYSTEMS",
  titleLine1 = "OPTRIZO",
  typewriterWords = [
    "CUSTOM SOLUTIONS",
    "ENTERPRISE WEB APPS",
    "SCALABLE ARCHITECTURE",
    "INTELLIGENT WORKFLOWS",
  ],
  taglineBold = "POWERED BY INNOVATION.",
  description = "We engineer bespoke web platforms, enterprise software, and scalable digital infrastructure through modern architecture.",
  ctaText = "Start a Project",
  ctaHref = "/contact",
  initialTheme = "light",
  stats = [
    { id: "001", title: "AVAILABILITY", val: "Open", type: "progress" },
    { id: "002", title: "STUDIO STATS", val: "50+ Shipped", type: "data" },
    {
      id: "003",
      title: "EXPERTISE",
      val: "Custom Solutions",
      type: "text",
      text: "Transforming complex business logic into high-velocity digital assets.",
    },
  ],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const ctaWrapperRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const rightDeckRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef<number>(0);

  const [mounted, setMounted] = useState(false);
  const [load3D, setLoad3D] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [isDark, setIsDark] = useState(initialTheme === "dark");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Respect reduced motion preference for accessibility and performance
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let loaded = false;
    let timer: NodeJS.Timeout | null = null;
    const container = containerRef.current;

    const cleanup = () => {
      window.removeEventListener("pointerdown", trigger3D);
      window.removeEventListener("keydown", trigger3D);
      window.removeEventListener("touchstart", trigger3D);
      if (container) {
        container.removeEventListener("pointerenter", trigger3D);
      }
      if (timer) clearTimeout(timer);
    };

    const trigger3D = () => {
      if (loaded) return;
      loaded = true;
      cleanup();

      // Defer Three.js canvas mount so it never competes with initial hydration or interaction metrics (TBT/INP)
      const mount = () => setLoad3D(true);
      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(
          () => {
            timer = setTimeout(mount, 400);
          },
          { timeout: 2000 }
        );
      } else {
        timer = setTimeout(mount, 600);
      }
    };

    // User interactions queue 3D scene smoothly
    if (container) {
      container.addEventListener("pointerenter", trigger3D, { passive: true, once: true });
    }
    window.addEventListener("pointerdown", trigger3D, { passive: true, once: true });
    window.addEventListener("keydown", trigger3D, { passive: true, once: true });
    window.addEventListener("touchstart", trigger3D, { passive: true, once: true });

    // Idle fallback: initialize after the page and main thread have settled beyond the initial audit window
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(
        () => {
          timer = setTimeout(trigger3D, 5500);
        },
        { timeout: 7000 }
      );
    } else {
      timer = setTimeout(trigger3D, 6000);
    }

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    setHasWebGL(isWebGLAvailable());
    if (!containerRef.current) return;

    gsap.registerPlugin(ScrollTrigger);

    const updateScrollProgress = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const h = rect.height || window.innerHeight;
      const p = Math.min(Math.max(-rect.top / h, 0), 1);
      scrollProgressRef.current = p;
    };

    updateScrollProgress();

    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top top",
      end: "bottom top",
      scrub: 0.5,
      onUpdate: (self) => {
        scrollProgressRef.current = self.progress;
      },
    });

    window.addEventListener("resize", updateScrollProgress, { passive: true });

    return () => {
      trigger.kill();
      window.removeEventListener("resize", updateScrollProgress);
    };
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
      if (typeof document !== "undefined") {
        try {
          const savedTheme = localStorage.getItem("optrizo-theme");
          const activeDark = savedTheme === "dark";
          setIsDark(activeDark);
          if (activeDark) {
            document.documentElement.classList.add("dark");
            document.documentElement.classList.remove("light");
            document.body?.classList.add("dark");
            document.body?.classList.remove("light");
          } else {
            document.documentElement.classList.remove("dark");
            document.documentElement.classList.add("light");
            document.body?.classList.remove("dark");
            document.body?.classList.add("light");
          }
        } catch {
          // ignore localStorage access error
        }
      }
    });

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ isDark: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.isDark === "boolean") {
        setIsDark(customEvent.detail.isDark);
      } else {
        const saved = localStorage.getItem("optrizo-theme");
        setIsDark(saved === "dark");
      }
    };

    window.addEventListener("optrizo-theme-change", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);

    return () => {
      window.removeEventListener("optrizo-theme-change", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (typeof document !== "undefined") {
      try {
        localStorage.setItem("optrizo-theme", nextDark ? "dark" : "light");
      } catch {
        // Ignore storage errors
      }

      if (nextDark) {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
        document.body?.classList.add("dark");
        document.body?.classList.remove("light");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
        document.body?.classList.remove("dark");
        document.body?.classList.add("light");
      }

      window.dispatchEvent(
        new CustomEvent("optrizo-theme-change", { detail: { isDark: nextDark } })
      );
    }
  }, [isDark]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 1. Sleek Snappy Cinematic Entrance Timeline
      const enterTl = gsap.timeline({ defaults: { ease: "power2.out" } });

      enterTl
        .from(
          topBarRef.current,
          { y: -10, duration: 0.35 }
        )
        .from(
          headlineRef.current,
          { y: 12, duration: 0.35 },
          "-=0.25"
        )
        .from(
          ctaWrapperRef.current,
          { y: 10, duration: 0.3 },
          "-=0.25"
        )
        .from(
          ".command-cell",
          {
            x: 15,
            scale: 0.98,
            stagger: 0.04,
            duration: 0.35,
            clearProps: "transform",
          },
          "-=0.25"
        );

      // 2. Scroll-Driven Parallax & Optical Dissolution Timeline
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "72% top",
          scrub: 0.6,
        },
      });

      if (topBarRef.current) {
        scrollTl.to(
          topBarRef.current,
          {
            y: -35,
            opacity: 0,
            ease: "none",
          },
          0
        );
      }

      if (headlineRef.current) {
        scrollTl.to(
          headlineRef.current,
          {
            y: -85,
            opacity: 0,
            ease: "none",
          },
          0
        );
      }

      if (ctaWrapperRef.current) {
        scrollTl.to(
          ctaWrapperRef.current,
          {
            y: -50,
            opacity: 0,
            filter: "blur(6px)",
            ease: "none",
          },
          0.02
        );
      }

      // Staggered depth parallax on command cards (different vertical velocities)
      scrollTl.to(
        ".command-cell-0",
        {
          y: -70,
          opacity: 0,
          filter: "blur(6px)",
          ease: "none",
        },
        0.03
      );

      scrollTl.to(
        ".command-cell-1",
        {
          y: -120,
          opacity: 0,
          filter: "blur(8px)",
          ease: "none",
        },
        0.06
      );

      scrollTl.to(
        ".command-cell-2",
        {
          y: -170,
          opacity: 0,
          filter: "blur(10px)",
          ease: "none",
        },
        0.09
      );

      // 3. Scoped Magnetic Cursor Tracking (Active only on button wrapper)
      const wrapper = ctaWrapperRef.current;
      let rafId: number | null = null;

      if (wrapper) {
        const handleMouseMove = (e: MouseEvent) => {
          if (rafId !== null) return;

          rafId = requestAnimationFrame(() => {
            rafId = null;
            if (!ctaRef.current) return;
            const rect = ctaRef.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            gsap.to(ctaRef.current, {
              x: (e.clientX - centerX) * 0.35,
              y: (e.clientY - centerY) * 0.35,
              duration: 0.4,
              ease: "power2.out",
              overwrite: "auto",
            });
          });
        };

        const handleMouseLeave = () => {
          if (rafId !== null) cancelAnimationFrame(rafId);
          if (!ctaRef.current) return;
          gsap.to(ctaRef.current, {
            x: 0,
            y: 0,
            duration: 0.7,
            ease: "elastic.out(1, 0.35)",
            overwrite: "auto",
          });
        };

        wrapper.addEventListener("mousemove", handleMouseMove, { passive: true });
        wrapper.addEventListener("mouseleave", handleMouseLeave, { passive: true });
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className={`relative min-h-screen w-full transition-colors duration-500 flex flex-col overflow-hidden will-change-auto bg-background ${isDark
          ? "text-white selection:bg-[#00D639] selection:text-black"
          : "text-neutral-900 selection:bg-[#00D639] selection:text-black"
        }`}
    >
      {/* Optimized 3D WebGL Canvas Layer with Capability Guard & Error Boundary */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {mounted && load3D && hasWebGL ? (
          <Hero3DScene
            isDark={isDark}
            scrollRef={scrollProgressRef}
            fallback={<HeroCyberFallback isDark={isDark} />}
          />
        ) : (
          <HeroCyberFallback isDark={isDark} />
        )}
      </div>

      {/* Seamless Bottom Blend Gradient: melts 3D lighting, contact shadows, & canvas into page background */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-44 md:h-64 bg-gradient-to-t from-background via-background/80 to-transparent z-[2]"
        aria-hidden="true"
      />

      {/* Hero Foreground Content */}
      <div
        ref={revealRef}
        className="relative z-10 w-full flex flex-col md:flex-row pt-28 pb-12 px-8 md:pt-32 md:pb-14 md:px-14 lg:pt-36 lg:pb-20 lg:px-20 min-h-screen items-center md:items-stretch gap-10"
      >
        <div className="flex-1 min-w-0 flex flex-col justify-between pb-8 w-full">
          {/* Top Bar: Optrizo Hexagonal Mark, Status Beacon & Theme Switcher */}
          <div ref={topBarRef} className="flex items-center justify-between gap-4 w-full will-change-transform">
            <div className="flex items-center gap-3">
              {/* Miniature Isometric Hexagon Icon matching Optrizo Logo */}
              <div className="flex items-center justify-center">
                <svg
                  width="18"
                  height="20"
                  viewBox="0 0 24 26"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-[#00D639]"
                >
                  <path
                    d="M12 1L22 6.77V19.23L12 25L2 19.23V6.77L12 1Z"
                    stroke="#00D639"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7 16V12M12 18V8M17 16V10"
                    stroke="#00D639"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* Pulsing Electric Green Beacon */}
              <div className="relative w-2 h-2 rounded-full bg-[#00D639]">
                <div className="absolute inset-0 rounded-full animate-ping opacity-60 bg-[#00D639]" />
              </div>

              <span
                className={`font-mono text-[11px] font-bold tracking-[0.2em] uppercase ${isDark ? "text-white" : "text-neutral-950"
                  }`}
              >
                {badgeText}
              </span>
            </div>

            {/* Tactile Theme Switcher */}
            <button
              onClick={toggleTheme}
              type="button"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[10px] font-mono tracking-widest uppercase transition-all duration-300 backdrop-blur-md cursor-pointer ${isDark
                  ? "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  : "border-black/15 bg-black/5 text-neutral-700 hover:bg-black/10 hover:text-black shadow-sm"
                }`}
              title="Toggle Noir / Alabaster Mode"
            >
              {isDark ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#00D639]" />
                  <span>NOIR // 01</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#00B830]" />
                  <span>ALABASTER // 02</span>
                </>
              )}
            </button>
          </div>

          {/* Headline with Live Typewriter Effect */}
          <div ref={headlineRef} className="max-w-4xl lg:-translate-y-6 pr-4 md:pr-12 mt-10 md:mt-0 will-change-transform">
            <h1
              className={`text-[clamp(2.4rem,6.8vw,8.5rem)] font-black leading-[0.88] tracking-tighter uppercase ${isDark ? "text-white" : "text-neutral-950"
                }`}
            >
              {titleLine1} <br />
              {/* Typewriter Effect with Electric Green Cursor & Zero Layout Shift */}
              <div className="min-h-[1.15em] block">
                <TypewriterHeadline words={typewriterWords} />
              </div>
            </h1>

            {/* Logo-Aligned Tagline & Description */}
            <div className="mt-8 max-w-lg">
              <p
                className={`font-mono text-[12px] font-bold tracking-[0.22em] uppercase mb-2 ${isDark ? "text-white" : "text-neutral-950"
                  }`}
              >
                {taglineBold}
                <span className="text-[#00D639] font-black">{" //"}</span>
              </p>
              <p
                className={`font-mono text-[11px] uppercase tracking-[0.28em] leading-relaxed ${isDark ? "text-white/70" : "text-neutral-900 font-medium"
                  }`}
              >
                {description}
              </p>
            </div>
          </div>

          {/* Magnetic CTA Button with Electric Green Glow */}
          <div ref={ctaWrapperRef} className="w-fit will-change-transform">
            <Link
              ref={ctaRef}
              href={ctaHref}
              className="w-fit flex items-center gap-6 group lg:-translate-y-12 mt-8 md:mt-0"
            >
              <div
                className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all duration-500 overflow-hidden ${isDark
                    ? "border-white/20 group-hover:border-[#00D639] group-hover:bg-[#00D639] shadow-sm group-hover:shadow-[0_0_25px_rgba(0,214,57,0.4)] bg-background/40 backdrop-blur-sm"
                    : "border-neutral-900/20 group-hover:border-[#00D639] group-hover:bg-[#00D639] shadow-sm group-hover:shadow-[0_0_25px_rgba(0,214,57,0.3)] bg-background/60 backdrop-blur-sm"
                  }`}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={`transition-colors duration-500 ${isDark
                      ? "stroke-white group-hover:stroke-black"
                      : "stroke-neutral-950 group-hover:stroke-black"
                    }`}
                >
                  <path
                    d="M7 17L17 7M17 7H8M17 7V16"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span
                className={`font-mono text-[11px] font-bold uppercase tracking-[0.2em] transition-colors ${isDark
                    ? "text-white group-hover:text-[#00D639]"
                    : "text-neutral-950 group-hover:text-[#00B830]"
                  }`}
              >
                {ctaText}
              </span>
            </Link>
          </div>
        </div>

        {/* Right Side Deck: Command Cells */}
        <div ref={rightDeckRef} className="w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col gap-4 justify-center z-20">
          {stats.map((item, idx) => (
            <div
              key={item.id}
              className={`command-cell command-cell-${idx} glass-panel p-6 sm:p-7 block transition-colors duration-500 will-change-transform hover:border-[#00D639]/40 ${isDark ? "text-white" : "text-neutral-950 shadow-sm"
                }`}
            >
              <span
                className={`font-mono text-[9px] uppercase tracking-widest block mb-3 ${isDark ? "text-white/30" : "text-neutral-700 font-semibold"
                  }`}
              >
                {item.id}{" // "}{item.title}
              </span>

              {item.type === "progress" ? (
                <div className="flex justify-between items-end mt-2">
                  <p className="text-2xl sm:text-3xl font-bold tracking-tighter flex items-center gap-2">
                    {item.val}
                    <span className="inline-block w-2 h-2 rounded-full bg-[#00D639] animate-pulse" />
                  </p>
                  <div
                    className={`h-[2px] w-20 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-neutral-900/10"
                      }`}
                  >
                    <div className="h-full w-[65%] animate-loading bg-[#00D639]" />
                  </div>
                </div>
              ) : item.type === "data" ? (
                <div className="mt-4 flex flex-col gap-3">
                  <div
                    className={`flex justify-between text-[10px] font-mono ${isDark ? "text-white/50" : "text-neutral-700 font-medium"
                      }`}
                  >
                    <span>{item.subtext1 || "Client NPS"}</span>
                    <span className="text-[#00D639] font-bold">2024-26</span>
                  </div>
                  <div
                    className={`h-[1px] w-full ${isDark ? "bg-white/10" : "bg-neutral-900/10"
                      }`}
                  />
                  <div
                    className={`flex justify-between text-[10px] font-mono ${isDark ? "text-white/50" : "text-neutral-700 font-medium"
                      }`}
                  >
                    <span>{item.subtext2 || "System Uptime"}</span>
                    <span className="text-[#00D639] font-bold">99.9%</span>
                  </div>
                </div>
              ) : (
                <p
                  className={`text-sm font-medium mt-3 leading-snug ${isDark ? "text-white/70" : "text-neutral-800"
                    }`}
                >
                  {item.text || (
                    <>
                      Transforming complex business logic into{" "}
                      <span className="italic font-semibold text-[#00D639]">
                        high-velocity digital assets
                      </span>
                      .
                    </>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const Component = ExperienceHero;
export default ExperienceHero;
