"use client";

import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, MeshDistortMaterial, useGLTF, Center } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { Sun, Moon } from "lucide-react";

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
  pauseDelay = 2200,
  className = "",
}) => {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!words || words.length === 0) return;

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
  }, [subIndex, index, isDeleting, words, typeSpeed, deleteSpeed, pauseDelay]);

  const currentWord = words[index % words.length] || "";
  const displayedText = currentWord.substring(0, subIndex);

  return (
    <span className={`inline relative ${className}`}>
      <span className="text-outline will-change-contents">{displayedText}</span>
      <span
        className="inline-block w-[3px] sm:w-[4px] md:w-[6px] h-[0.78em] ml-1.5 bg-[#00D639] animate-pulse align-[-0.04em] shadow-[0_0_12px_#00D639] rounded-[1px]"
        aria-hidden="true"
      />
    </span>
  );
};

// --- Optimized GPU Liquid Shader ---
interface LiquidBackgroundProps {
  isDark: boolean;
}

const LiquidBackground: React.FC<LiquidBackgroundProps> = ({ isDark }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uIsDark: { value: isDark ? 1.0 : 0.0 },
    }),
    [isDark]
  );

  useEffect(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial;
      if (mat?.uniforms?.uIsDark) {
        gsap.to(mat.uniforms.uIsDark, {
          value: isDark ? 1.0 : 0.0,
          duration: 0.8,
          ease: "power2.out",
        });
      }
    }
  }, [isDark]);

  useFrame((state) => {
    const { clock, mouse } = state;
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial;
      if (mat?.uniforms) {
        mat.uniforms.uTime.value = clock.getElapsedTime();
        mat.uniforms.uMouse.value.lerp(mouse, 0.04);
      }
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -35]} scale={[viewport.width * 1.6, viewport.height * 1.6, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          precision mediump float;
          uniform float uTime;
          uniform vec2 uMouse;
          uniform float uIsDark;
          varying vec2 vUv;
          void main() {
            vec2 uv = vUv;
            float t = uTime * 0.14;
            vec2 m = uMouse * 0.08;
            float color = smoothstep(0.0, 1.0, (sin(uv.x * 7.0 + t + m.x * 10.0) + sin(uv.y * 5.5 - t + m.y * 10.0)) * 0.5 + 0.5);
            
            // Dynamic vertical falloff: softly dissolve shader caustics and glow toward bottom
            float bottomFalloff = smoothstep(0.08, 0.42, uv.y);

            // Alabaster background matching oklch(97.02% 0.0020 148.67) ~ #F6F8F6
            vec3 lightBg = vec3(0.965, 0.970, 0.966);
            vec3 lightPearl = mix(lightBg, vec3(0.945, 0.958, 0.948), color * 0.4);
            vec3 lightGreenGlow = vec3(0.0, 0.84, 0.22) * pow(color, 3.5) * 0.05 * bottomFalloff;
            vec3 lightColor = mix(lightBg, lightPearl + lightGreenGlow, bottomFalloff);

            // Noir dark background matching oklch(12.00% 0.0020 148.67) ~ #0A0D0B
            vec3 darkBg = vec3(0.035, 0.038, 0.036);
            vec3 darkCaustics = mix(darkBg, vec3(0.050, 0.065, 0.055), color);
            vec3 darkGreenGlow = vec3(0.0, 0.84, 0.22) * pow(color, 4.0) * 0.18 * bottomFalloff;
            vec3 darkColor = mix(darkBg, darkCaustics + darkGreenGlow, bottomFalloff);

            vec3 finalColor = mix(lightColor, darkColor, uIsDark);
            gl_FragColor = vec4(finalColor, 1.0);
          }
        `}
      />
    </mesh>
  );
};

// --- Procedural 3D Optrizo Logo Model (Option 1: Pure Three.js Extrusion) ---
interface OptrizoLogo3DProps {
  isDark: boolean;
}

const OptrizoLogo3D: React.FC<OptrizoLogo3DProps> = ({ isDark }) => {
  const groupRef = useRef<THREE.Group>(null);
  const frameRef = useRef<THREE.Mesh>(null);
  const pillarsRef = useRef<THREE.Group>(null);

  // Generate the 3D geometries for the Optrizo Logo mark
  const { frameGeometry, pillar1Geo, pillar2Geo, pillar3Geo } = useMemo(() => {
    // 1. Outer Hexagon Frame Shape with Inner Cutout Hole
    const frameShape = new THREE.Shape();
    const R = 9.5; // Outer radius
    const r = 7.6; // Inner cutout radius (creates the clean hexagonal ribbon thickness)

    // Calculate hexagon 6-point vertices (pointed top)
    const getHexPoints = (radius: number) => {
      const pts: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2; // Pointed at top and bottom
        pts.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
      }
      return pts;
    };

    const outerPts = getHexPoints(R);
    frameShape.moveTo(outerPts[0][0], outerPts[0][1]);
    for (let i = 1; i < outerPts.length; i++) {
      frameShape.lineTo(outerPts[i][0], outerPts[i][1]);
    }
    frameShape.closePath();

    // Hole: inner hexagon cutout
    const holePath = new THREE.Path();
    const innerPts = getHexPoints(r);
    holePath.moveTo(innerPts[0][0], innerPts[0][1]);
    for (let i = 1; i < innerPts.length; i++) {
      holePath.lineTo(innerPts[i][0], innerPts[i][1]);
    }
    holePath.closePath();
    frameShape.holes.push(holePath);

    const extrudeSettings = {
      depth: 3.2,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.35,
      bevelThickness: 0.35,
    };

    const frameGeo = new THREE.ExtrudeGeometry(frameShape, extrudeSettings);
    frameGeo.center();

    // 2. The 3 Ascending Interior Pillars (forming the growth chart / M-shape inside the Optrizo logo)
    const pillarWidth = 1.35;
    const pillarDepth = 3.0;

    // Pillar 1 (Left, lower height)
    const p1Height = 5.2;
    const p1Geo = new THREE.BoxGeometry(pillarWidth, p1Height, pillarDepth);

    // Pillar 2 (Center, tallest peak)
    const p2Height = 8.6;
    const p2Geo = new THREE.BoxGeometry(pillarWidth, p2Height, pillarDepth);

    // Pillar 3 (Right, medium-high)
    const p3Height = 6.8;
    const p3Geo = new THREE.BoxGeometry(pillarWidth, p3Height, pillarDepth);

    return {
      frameGeometry: frameGeo,
      pillar1Geo: p1Geo,
      pillar2Geo: p2Geo,
      pillar3Geo: p3Geo,
    };
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      // Elegant 3D floating and isometric rotation showcasing depth & bevels
      groupRef.current.rotation.y = t * 0.22;
      groupRef.current.rotation.x = Math.sin(t * 0.15) * 0.08 + 0.36; // Isometric tilt
    }
  });

  return (
    <Float speed={1.8} rotationIntensity={0.5} floatIntensity={1.2}>
      <group ref={groupRef} rotation={[0.36, Math.PI / 6, 0]} scale={[1.15, 1.15, 1.15]}>
        {/* Outer Hexagonal Frame in Optrizo Electric Green & Chrome */}
        <mesh ref={frameRef} geometry={frameGeometry} castShadow receiveShadow>
          <MeshDistortMaterial
            color="#00D639"
            speed={1.5}
            distort={0.08}
            roughness={isDark ? 0.15 : 0.2}
            metalness={isDark ? 0.88 : 0.75}
          />
        </mesh>

        {/* Interior Ascending Pillars */}
        <group ref={pillarsRef} position={[0, -0.6, 0]}>
          {/* Pillar 1 (Left) */}
          <mesh position={[-2.4, -0.8, 0]} geometry={pillar1Geo} castShadow receiveShadow>
            <meshStandardMaterial
              color="#00D639"
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>

          {/* Pillar 2 (Center - Tallest) */}
          <mesh position={[0, 0.9, 0]} geometry={pillar2Geo} castShadow receiveShadow>
            <meshStandardMaterial
              color="#00D639"
              roughness={0.15}
              metalness={0.85}
              emissive={isDark ? "#003b0f" : "#000000"}
              emissiveIntensity={0.3}
            />
          </mesh>

          {/* Pillar 3 (Right) */}
          <mesh position={[2.4, 0.0, 0]} geometry={pillar3Geo} castShadow receiveShadow>
            <meshStandardMaterial
              color="#00D639"
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>
        </group>

        {/* Floating Wireframe Edge Accent for Modern Tech Vibe */}
        <mesh geometry={frameGeometry} scale={[1.01, 1.01, 1.01]}>
          <meshBasicMaterial
            wireframe
            color={isDark ? "#ffffff" : "#0a0a0a"}
            transparent
            opacity={isDark ? 0.18 : 0.12}
          />
        </mesh>
      </group>
    </Float>
  );
};

// --- Custom Imported GLB 3D Model Loader ---
const OptrizoLogoModel: React.FC<OptrizoLogo3DProps> = ({ isDark }) => {
  const { scene } = useGLTF("/models/optrizo-3d-model.glb");
  const groupRef = useRef<THREE.Group>(null);

  const posX = 0;
  const posY = 0;

  // Clone scene & tune materials for deeper shadow contrast and Optrizo brand luster
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Rich high-contrast material with deep shadow definition & self-shadowing
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#00D639"),
          roughness: isDark ? 0.26 : 0.28,
          metalness: isDark ? 0.42 : 0.32,
          emissive: new THREE.Color("#000000"),
          emissiveIntensity: 0.0, // Zero self-illumination in crevices so shadows are deep and rich
          transparent: false,
          opacity: 1.0,
          side: THREE.DoubleSide,
        });
        mesh.material = mat;
      }
    });
    return clone;
  }, [scene, isDark]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const { mouse } = state;
    if (groupRef.current) {
      // Gentle 3D floating and mouse responsiveness showcasing depth while standing upright
      groupRef.current.rotation.y = Math.sin(t * 0.45) * 0.32 + mouse.x * 0.25;
      groupRef.current.rotation.x = Math.sin(t * 0.35) * 0.08 + 0.12 - mouse.y * 0.18;
    }
  });

  return (
    <>
      <Float speed={1.6} rotationIntensity={0.3} floatIntensity={0.8}>
        <group ref={groupRef} position={[posX, posY, 0]}>
          <Center>
            {/* Rotate +90deg on X to bring -Z (top apex) to +Y (up) and +Y (front face) to +Z (facing viewer) */}
            {/* Scale increased to 4.5 for a grand, impressive presence */}
            <primitive object={clonedScene} rotation={[Math.PI / 2, 0, 0]} scale={4.5} />
          </Center>
        </group>
      </Float>

      {/* Architectural Wall Shadow Receiver directly behind the 3D sculpture */}
      <mesh position={[posX, posY, -6]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial
          transparent
          opacity={isDark ? 0.40 : 0.15}
          color={isDark ? "#000000" : "#001a06"}
        />
      </mesh>
    </>
  );
};

if (typeof window !== "undefined") {
  useGLTF.preload("/models/optrizo-3d-model.glb");
}

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

export const Component: React.FC<ExperienceHeroProps> = ({
  badgeText = "OPTRIZO // CUSTOM SOLUTIONS",
  titleLine1 = "OPTRIZO",
  typewriterWords = [
    "CUSTOM SOLUTIONS",
    "DIGITAL PLATFORMS",
    "WEB INNOVATION",
    "SCALABLE SYSTEMS",
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
  const ctaRef = useRef<HTMLAnchorElement>(null);

  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(initialTheme === "dark");

  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
      if (typeof document !== "undefined") {
        try {
          const savedTheme = localStorage.getItem("optrizo-theme");
          if (savedTheme === "dark") {
            setIsDark(true);
            document.documentElement.classList.add("dark");
            document.documentElement.classList.remove("light");
            document.body.classList.add("dark");
            document.body.classList.remove("light");
            return;
          } else if (savedTheme === "light") {
            setIsDark(false);
            document.documentElement.classList.remove("dark");
            document.documentElement.classList.add("light");
            document.body.classList.remove("dark");
            document.body.classList.add("light");
            return;
          }
        } catch {
          // ignore localStorage access error
        }
      }
    });
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
        document.body.classList.add("dark");
        document.body.classList.remove("light");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
        document.body.classList.remove("dark");
        document.body.classList.add("light");
      }
    }
  }, [isDark]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        revealRef.current,
        { filter: "blur(20px)", opacity: 0, scale: 1.01 },
        {
          filter: "blur(0px)",
          opacity: 1,
          scale: 1,
          duration: 1.8,
          ease: "expo.out",
        }
      );

      gsap.from(".command-cell", {
        x: 40,
        opacity: 0,
        stagger: 0.1,
        duration: 1.2,
        ease: "power4.out",
        delay: 0.6,
        clearProps: "all",
      });

      // Optimized Magnetic Cursor Tracking (Throttled via RAF + Cached Rect)
      let cachedRect: DOMRect | null = null;
      let rafId: number | null = null;

      const updateRect = () => {
        if (ctaRef.current) {
          cachedRect = ctaRef.current.getBoundingClientRect();
        }
      };

      updateRect();
      window.addEventListener("resize", updateRect, { passive: true });
      window.addEventListener("scroll", updateRect, { passive: true });

      const handleMouseMove = (e: MouseEvent) => {
        if (rafId !== null) return;

        rafId = requestAnimationFrame(() => {
          rafId = null;
          if (!ctaRef.current) return;
          if (!cachedRect) {
            cachedRect = ctaRef.current.getBoundingClientRect();
          }

          const centerX = cachedRect.left + cachedRect.width / 2;
          const centerY = cachedRect.top + cachedRect.height / 2;
          const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);

          if (dist < 150) {
            gsap.to(ctaRef.current, {
              x: (e.clientX - centerX) * 0.35,
              y: (e.clientY - centerY) * 0.35,
              duration: 0.5,
              ease: "power2.out",
              overwrite: "auto",
            });
          } else {
            gsap.to(ctaRef.current, {
              x: 0,
              y: 0,
              duration: 0.7,
              ease: "elastic.out(1, 0.35)",
              overwrite: "auto",
            });
          }
        });
      };

      window.addEventListener("mousemove", handleMouseMove, { passive: true });

      return () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("resize", updateRect);
        window.removeEventListener("scroll", updateRect);
      };
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className={`relative min-h-screen w-full transition-colors duration-500 flex flex-col overflow-hidden will-change-auto bg-background ${
        isDark
          ? "text-white selection:bg-[#00D639] selection:text-black"
          : "text-neutral-900 selection:bg-[#00D639] selection:text-black"
      }`}
    >
      {/* Optimized 3D WebGL Canvas Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {mounted && (
          <Canvas
            shadows
            dpr={[1, 1.5]}
            gl={{
              powerPreference: "high-performance",
              antialias: true,
              alpha: true,
              stencil: false,
              depth: true,
            }}
            camera={{ position: [0, 0, 60], fov: 35 }}
          >
            <ambientLight intensity={isDark ? 0.22 : 0.45} />
            <directionalLight
              position={[12, 26, 48]}
              intensity={isDark ? 3.4 : 3.8}
              castShadow
              shadow-mapSize={[1024, 1024]}
              shadow-camera-near={10}
              shadow-camera-far={90}
              shadow-camera-left={-22}
              shadow-camera-right={22}
              shadow-camera-top={22}
              shadow-camera-bottom={-22}
              shadow-bias={-0.0002}
              shadow-normalBias={0.03}
              shadow-radius={4.0}
            />
            <directionalLight
              position={[-15, 10, 35]}
              intensity={isDark ? 1.0 : 1.2}
            />
            <pointLight
              position={[25, -10, 20]}
              intensity={isDark ? 2.0 : 1.4}
              color="#00D639"
              distance={90}
            />
            <pointLight
              position={[-30, 20, 15]}
              intensity={isDark ? 1.0 : 1.0}
              color="#ffffff"
            />
            <LiquidBackground isDark={isDark} />
            <React.Suspense fallback={<OptrizoLogo3D isDark={isDark} />}>
              <OptrizoLogoModel isDark={isDark} />
            </React.Suspense>
          </Canvas>
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
          <div className="flex items-center justify-between gap-4 w-full">
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
                className={`font-mono text-[11px] font-bold tracking-[0.2em] uppercase ${
                  isDark ? "text-white" : "text-neutral-950"
                }`}
              >
                {badgeText}
              </span>
            </div>

            {/* Tactile Theme Switcher */}
            <button
              onClick={toggleTheme}
              type="button"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[10px] font-mono tracking-widest uppercase transition-all duration-300 backdrop-blur-md cursor-pointer ${
                isDark
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
          <div className="max-w-4xl lg:-translate-y-6 pr-4 md:pr-12 mt-10 md:mt-0">
            <h1
              className={`text-[clamp(2.4rem,6.8vw,8.5rem)] font-black leading-[0.88] tracking-tighter uppercase ${
                isDark ? "text-white" : "text-neutral-950"
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
                className={`font-mono text-[12px] font-bold tracking-[0.22em] uppercase mb-2 ${
                  isDark ? "text-white" : "text-neutral-950"
                }`}
              >
                {taglineBold}
                <span className="text-[#00D639] font-black">{" //"}</span>
              </p>
              <p
                className={`font-mono text-[11px] uppercase tracking-[0.28em] leading-relaxed ${
                  isDark ? "text-white/45" : "text-neutral-700 font-medium"
                }`}
              >
                {description}
              </p>
            </div>
          </div>

          {/* Magnetic CTA Button with Electric Green Glow */}
          <Link
            ref={ctaRef}
            href={ctaHref}
            className="w-fit flex items-center gap-6 group lg:-translate-y-12 mt-8 md:mt-0"
          >
            <div
              className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all duration-500 overflow-hidden ${
                isDark
                  ? "border-white/20 group-hover:border-[#00D639] group-hover:bg-[#00D639] shadow-sm group-hover:shadow-[0_0_25px_rgba(0,214,57,0.4)]"
                  : "border-neutral-900/20 group-hover:border-[#00D639] group-hover:bg-[#00D639] shadow-sm group-hover:shadow-[0_0_25px_rgba(0,214,57,0.3)]"
              }`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-colors duration-500 ${
                  isDark
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
              className={`font-mono text-[11px] font-bold uppercase tracking-[0.2em] transition-colors ${
                isDark
                  ? "text-white group-hover:text-[#00D639]"
                  : "text-neutral-950 group-hover:text-[#00B830]"
              }`}
            >
              {ctaText}
            </span>
          </Link>
        </div>

        {/* Right Side Deck: Command Cells */}
        <div className="w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col gap-4 justify-center z-20">
          {stats.map((item) => (
            <div
              key={item.id}
              className={`command-cell glass-panel p-6 sm:p-7 block transition-colors duration-500 ${
                isDark ? "text-white" : "text-neutral-950 shadow-sm"
              }`}
            >
              <span
                className={`font-mono text-[9px] uppercase tracking-widest block mb-3 ${
                  isDark ? "text-white/30" : "text-neutral-700 font-semibold"
                }`}
              >
                {item.id}{" // "}{item.title}
              </span>

              {item.type === "progress" ? (
                <div className="flex justify-between items-end mt-2">
                  <h4 className="text-2xl sm:text-3xl font-bold tracking-tighter flex items-center gap-2">
                    {item.val}
                    <span className="inline-block w-2 h-2 rounded-full bg-[#00D639] animate-pulse" />
                  </h4>
                  <div
                    className={`h-[2px] w-20 rounded-full overflow-hidden ${
                      isDark ? "bg-white/10" : "bg-neutral-900/10"
                    }`}
                  >
                    <div className="h-full w-[65%] animate-loading bg-[#00D639]" />
                  </div>
                </div>
              ) : item.type === "data" ? (
                <div className="mt-4 flex flex-col gap-3">
                  <div
                    className={`flex justify-between text-[10px] font-mono ${
                      isDark ? "text-white/50" : "text-neutral-700 font-medium"
                    }`}
                  >
                    <span>{item.subtext1 || "Client NPS"}</span>
                    <span className="text-[#00D639] font-bold">2024-26</span>
                  </div>
                  <div
                    className={`h-[1px] w-full ${
                      isDark ? "bg-white/10" : "bg-neutral-900/10"
                    }`}
                  />
                  <div
                    className={`flex justify-between text-[10px] font-mono ${
                      isDark ? "text-white/50" : "text-neutral-700 font-medium"
                    }`}
                  >
                    <span>{item.subtext2 || "System Uptime"}</span>
                    <span className="text-[#00D639] font-bold">99.9%</span>
                  </div>
                </div>
              ) : (
                <h3
                  className={`text-sm font-medium mt-3 leading-snug ${
                    isDark ? "text-white/70" : "text-neutral-800"
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
                </h3>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const ExperienceHero = Component;
export default Component;
