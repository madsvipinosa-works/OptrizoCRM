"use client";

import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, MeshDistortMaterial, useGLTF, Center } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Sun, Moon } from "lucide-react";

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
  scrollRef?: React.RefObject<number>;
}

const LiquidBackground: React.FC<LiquidBackgroundProps> = ({ isDark, scrollRef }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uIsDark: { value: isDark ? 1.0 : 0.0 },
      uScroll: { value: 0.0 },
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

  useFrame((state, delta) => {
    const { clock, mouse } = state;
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial;
      if (mat?.uniforms) {
        mat.uniforms.uTime.value = clock.getElapsedTime();
        mat.uniforms.uMouse.value.lerp(mouse, 0.04);
        const targetScroll = scrollRef?.current ?? 0;
        mat.uniforms.uScroll.value = THREE.MathUtils.damp(
          mat.uniforms.uScroll.value,
          targetScroll,
          4.0,
          delta
        );
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
          uniform float uScroll;
          varying vec2 vUv;
          void main() {
            vec2 uv = vUv;
            float t = uTime * 0.14;
            vec2 m = uMouse * 0.08;
            float color = smoothstep(0.0, 1.0, (sin(uv.x * 7.0 + t + m.x * 10.0) + sin(uv.y * 5.5 - t + m.y * 10.0)) * 0.5 + 0.5);
            
            // Dynamic vertical falloff: softly dissolve shader caustics and glow toward bottom as user scrolls
            float scrollFade = clamp(1.0 - uScroll * 1.1, 0.0, 1.0);
            float bottomFalloff = smoothstep(0.08, 0.42, uv.y) * scrollFade;

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
  scrollRef?: React.RefObject<number>;
}

const OptrizoLogo3D: React.FC<OptrizoLogo3DProps> = ({ isDark, scrollRef }) => {
  const scrollGroupRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);
  const frameRef = useRef<THREE.Mesh>(null);
  const pillarsRef = useRef<THREE.Group>(null);
  const currentScroll = useRef(0);
  const materialsRef = useRef<THREE.Material[]>([]);

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

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const target = scrollRef?.current ?? 0;

    // Frame-rate independent smooth damping
    currentScroll.current = THREE.MathUtils.damp(
      currentScroll.current,
      target,
      5.5,
      delta
    );
    const p = currentScroll.current;

    // Sinking & recede physics on the outer group
    if (scrollGroupRef.current) {
      const sinkY = -p * 30;
      const sinkZ = -p * 24;
      const scaleMultiplier = THREE.MathUtils.lerp(1.0, 0.28, p);
      const tiltX = p * 0.65;
      const spinY = p * 0.9;

      scrollGroupRef.current.position.set(0, sinkY, sinkZ);
      scrollGroupRef.current.scale.setScalar(scaleMultiplier);
      scrollGroupRef.current.rotation.set(tiltX, spinY, 0);

      // Disappear transition: smooth opacity fade out
      const fadeStart = 0.10;
      const fadeEnd = 0.65;
      const fadeRatio = THREE.MathUtils.clamp((p - fadeStart) / (fadeEnd - fadeStart), 0, 1);
      const currentOpacity = 1.0 - fadeRatio;

      materialsRef.current.forEach((mat) => {
        mat.opacity = currentOpacity;
        mat.transparent = true;
      });

      scrollGroupRef.current.visible = currentOpacity > 0.002;
    }

    if (groupRef.current) {
      // Elegant 3D floating and isometric rotation showcasing depth & bevels
      groupRef.current.rotation.y = t * 0.22;
      groupRef.current.rotation.x = Math.sin(t * 0.15) * 0.08 + 0.36; // Isometric tilt
    }
  });

  return (
    <group ref={scrollGroupRef}>
      <Float speed={1.8} rotationIntensity={0.5} floatIntensity={1.2}>
        <group ref={groupRef} rotation={[0.36, Math.PI / 6, 0]} scale={[1.15, 1.15, 1.15]}>
          {/* Outer Hexagonal Frame in Optrizo Electric Green & Chrome */}
          <mesh ref={frameRef} geometry={frameGeometry} castShadow receiveShadow>
            <MeshDistortMaterial
              ref={(el) => {
                if (el && !materialsRef.current.includes(el)) materialsRef.current.push(el);
              }}
              color="#00D639"
              speed={1.5}
              distort={0.08}
              roughness={isDark ? 0.15 : 0.2}
              metalness={isDark ? 0.88 : 0.75}
              transparent
            />
          </mesh>

          {/* Interior Ascending Pillars */}
          <group ref={pillarsRef} position={[0, -0.6, 0]}>
            {/* Pillar 1 (Left) */}
            <mesh position={[-2.4, -0.8, 0]} geometry={pillar1Geo} castShadow receiveShadow>
              <meshStandardMaterial
                ref={(el) => {
                  if (el && !materialsRef.current.includes(el)) materialsRef.current.push(el);
                }}
                color="#00D639"
                roughness={0.2}
                metalness={0.8}
                transparent
              />
            </mesh>

            {/* Pillar 2 (Center - Tallest) */}
            <mesh position={[0, 0.9, 0]} geometry={pillar2Geo} castShadow receiveShadow>
              <meshStandardMaterial
                ref={(el) => {
                  if (el && !materialsRef.current.includes(el)) materialsRef.current.push(el);
                }}
                color="#00D639"
                roughness={0.15}
                metalness={0.85}
                emissive={isDark ? "#003b0f" : "#000000"}
                emissiveIntensity={0.3}
                transparent
              />
            </mesh>

            {/* Pillar 3 (Right) */}
            <mesh position={[2.4, 0.0, 0]} geometry={pillar3Geo} castShadow receiveShadow>
              <meshStandardMaterial
                ref={(el) => {
                  if (el && !materialsRef.current.includes(el)) materialsRef.current.push(el);
                }}
                color="#00D639"
                roughness={0.2}
                metalness={0.8}
                transparent
              />
            </mesh>
          </group>

          {/* Floating Wireframe Edge Accent for Modern Tech Vibe */}
          <mesh geometry={frameGeometry} scale={[1.01, 1.01, 1.01]}>
            <meshBasicMaterial
              ref={(el) => {
                if (el && !materialsRef.current.includes(el)) materialsRef.current.push(el);
              }}
              wireframe
              color={isDark ? "#ffffff" : "#0a0a0a"}
              transparent
              opacity={isDark ? 0.18 : 0.12}
            />
          </mesh>
        </group>
      </Float>
    </group>
  );
};

// --- Custom Imported GLB 3D Model Loader ---
const OptrizoLogoModel: React.FC<OptrizoLogo3DProps> = ({ isDark, scrollRef }) => {
  const { scene } = useGLTF("/models/optrizo-3d-model.glb");
  const scrollGroupRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);
  const shadowMatRef = useRef<THREE.ShadowMaterial>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const currentScroll = useRef(0);

  const posX = 0;
  const posY = 0;

  // Clone scene & tune materials for deeper shadow contrast and Optrizo brand luster
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    const mats: THREE.MeshStandardMaterial[] = [];
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
          transparent: true,
          opacity: 1.0,
          depthWrite: true,
          side: THREE.DoubleSide,
        });
        mesh.material = mat;
        mats.push(mat);
      }
    });
    materialsRef.current = mats;
    return clone;
  }, [scene, isDark]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const { mouse } = state;
    const target = scrollRef?.current ?? 0;

    // High-performance smooth damping across all refresh rates
    currentScroll.current = THREE.MathUtils.damp(
      currentScroll.current,
      target,
      5.5,
      delta
    );
    const p = currentScroll.current;

    // Mouse responsiveness dampens as the model submerges
    const mouseInfluence = Math.max(0, 1 - p * 1.8);
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.45) * 0.32 + mouse.x * 0.25 * mouseInfluence;
      groupRef.current.rotation.x = Math.sin(t * 0.35) * 0.08 + 0.12 - mouse.y * 0.18 * mouseInfluence;
    }

    // Dynamic Sinking, Receding & Disappearing on outer scroll group
    if (scrollGroupRef.current) {
      // Y: Sinks vertically into the bottom abyss
      const sinkY = -p * 32;
      // Z: Drops deeper into the liquid depth plane
      const sinkZ = -p * 26;
      // Scale: Shrinks down gracefully as it plunges away
      const currentScale = THREE.MathUtils.lerp(1.0, 0.25, p);
      // Angular tilt: pitches backward as it sinks
      const tiltX = p * 0.70;
      const spinY = p * 0.90;

      scrollGroupRef.current.position.set(posX, posY + sinkY, sinkZ);
      scrollGroupRef.current.scale.setScalar(currentScale);
      scrollGroupRef.current.rotation.set(tiltX, spinY, 0);

      // Disappear transition: fades out between 0.10 and 0.65 scroll progress
      const fadeStart = 0.10;
      const fadeEnd = 0.65;
      const fadeRatio = THREE.MathUtils.clamp((p - fadeStart) / (fadeEnd - fadeStart), 0, 1);
      const currentOpacity = 1.0 - fadeRatio;

      materialsRef.current.forEach((mat) => {
        mat.opacity = currentOpacity;
        mat.depthWrite = currentOpacity > 0.85; // Avoid transparency sort artifacts during fade
      });

      scrollGroupRef.current.visible = currentOpacity > 0.002;

      // Shadow receiver fades out in lockstep
      if (shadowMatRef.current) {
        const baseShadow = isDark ? 0.40 : 0.15;
        shadowMatRef.current.opacity = baseShadow * currentOpacity;
      }
    }
  });

  return (
    <>
      <group ref={scrollGroupRef} position={[posX, posY, 0]}>
        <Float speed={1.6} rotationIntensity={0.3} floatIntensity={0.8}>
          <group ref={groupRef}>
            <Center>
              {/* Rotate +90deg on X to bring -Z (top apex) to +Y (up) and +Y (front face) to +Z (facing viewer) */}
              {/* Scale 4.5 for grand, impressive presence */}
              <primitive object={clonedScene} rotation={[Math.PI / 2, 0, 0]} scale={4.5} />
            </Center>
          </group>
        </Float>
      </group>

      {/* Architectural Wall Shadow Receiver directly behind the 3D sculpture */}
      <mesh position={[posX, posY, -6]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial
          ref={shadowMatRef}
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
      <div className="relative w-64 h-64 md:w-80 md:h-80 opacity-35 animate-pulse">
        <svg viewBox="0 0 100 115" fill="none" className="w-full h-full">
          <polygon
            points="50 0, 100 28.8, 100 86.6, 50 115.5, 0 86.6, 0 28.8"
            stroke="#00D639"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className="animate-[spin_40s_linear_infinite]"
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
  const [hasWebGL, setHasWebGL] = useState(true);
  const [isDark, setIsDark] = useState(initialTheme === "dark");

  useEffect(() => {
    setHasWebGL(isWebGLAvailable());
    if (!containerRef.current) return;

    gsap.registerPlugin(ScrollTrigger);

    const updateScrollProgress = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const h = rect.height || window.innerHeight;
      const p = THREE.MathUtils.clamp(-rect.top / h, 0, 1);
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

    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    window.addEventListener("resize", updateScrollProgress, { passive: true });

    return () => {
      trigger.kill();
      window.removeEventListener("scroll", updateScrollProgress);
      window.removeEventListener("resize", updateScrollProgress);
    };
  }, []);

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
      // 1. Sleek Cinematic Entrance Timeline
      const enterTl = gsap.timeline({ defaults: { ease: "power3.out" } });

      enterTl
        .fromTo(
          revealRef.current,
          { filter: "blur(18px)", opacity: 0 },
          { filter: "blur(0px)", opacity: 1, duration: 1.2, ease: "expo.out" }
        )
        .fromTo(
          topBarRef.current,
          { y: -20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9 },
          "-=0.9"
        )
        .fromTo(
          headlineRef.current,
          { y: 35, opacity: 0, filter: "blur(10px)" },
          { y: 0, opacity: 1, filter: "blur(0px)", duration: 1.3 },
          "-=0.7"
        )
        .fromTo(
          ctaWrapperRef.current,
          { y: 25, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9 },
          "-=0.8"
        )
        .fromTo(
          ".command-cell",
          { x: 45, opacity: 0, scale: 0.96 },
          {
            x: 0,
            opacity: 1,
            scale: 1,
            stagger: 0.12,
            duration: 1.1,
            clearProps: "transform,opacity",
          },
          "-=0.9"
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
            filter: "blur(10px)",
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

      // 3. Optimized Magnetic Cursor Tracking (Throttled via RAF + Cached Rect)
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
      className={`relative min-h-screen w-full transition-colors duration-500 flex flex-col overflow-hidden will-change-auto bg-background ${isDark
          ? "text-white selection:bg-[#00D639] selection:text-black"
          : "text-neutral-900 selection:bg-[#00D639] selection:text-black"
        }`}
    >
      {/* Optimized 3D WebGL Canvas Layer with Capability Guard & Error Boundary */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {mounted && (
          hasWebGL ? (
            <WebGLErrorBoundary fallback={<HeroCyberFallback isDark={isDark} />}>
              <Canvas
                shadows
                dpr={[1, 1.5]}
                gl={{
                  powerPreference: "default",
                  antialias: true,
                  alpha: true,
                  stencil: false,
                  depth: true,
                  failIfMajorPerformanceCaveat: false,
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
                <LiquidBackground isDark={isDark} scrollRef={scrollProgressRef} />
                <React.Suspense fallback={<OptrizoLogo3D isDark={isDark} scrollRef={scrollProgressRef} />}>
                  <OptrizoLogoModel isDark={isDark} scrollRef={scrollProgressRef} />
                </React.Suspense>
              </Canvas>
            </WebGLErrorBoundary>
          ) : (
            <HeroCyberFallback isDark={isDark} />
          )
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
                className={`font-mono text-[11px] uppercase tracking-[0.28em] leading-relaxed ${isDark ? "text-white/45" : "text-neutral-700 font-medium"
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
                  <h4 className="text-2xl sm:text-3xl font-bold tracking-tighter flex items-center gap-2">
                    {item.val}
                    <span className="inline-block w-2 h-2 rounded-full bg-[#00D639] animate-pulse" />
                  </h4>
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
                <h3
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
                </h3>
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
