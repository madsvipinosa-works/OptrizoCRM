"use client";

import React, { useRef, useState, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Center, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { cn } from "@/lib/utils";

// --- WebGL Capability Check ---
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

interface OptrizoModelProps {
  isDark: boolean;
  scale?: number;
  rotationRef: React.MutableRefObject<{ x: number; y: number; targetX: number; targetY: number }>;
  scrollProgress?: { get: () => number };
}

function OptrizoModel({ isDark, scale = 1.32, rotationRef, scrollProgress }: OptrizoModelProps) {
  const { scene } = useGLTF("/models/optrizo-3d-model.glb");
  const groupRef = useRef<THREE.Group>(null);

  // Clone scene and apply Optrizo Electric Green standard material
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#00D639"),
          roughness: isDark ? 0.22 : 0.26,
          metalness: isDark ? 0.50 : 0.40,
          emissive: new THREE.Color("#001a06"),
          emissiveIntensity: isDark ? 0.25 : 0.15,
          side: THREE.DoubleSide,
        });
      }
    });
    return clone;
  }, [scene, isDark]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const rot = rotationRef.current;

    // Smooth physics damping towards target rotation (driven by drag & pointer)
    rot.x = THREE.MathUtils.damp(rot.x, rot.targetX, 6, delta);
    rot.y = THREE.MathUtils.damp(rot.y, rot.targetY, 6, delta);

    // Scroll progress evaluation (0 = approaching beforehand, 1 = arrived/centered)
    const rawProgress = scrollProgress ? scrollProgress.get() : 1;
    const clampedProgress = Math.min(Math.max(rawProgress, 0), 1);
    // Smooth cubic ease-out
    const easeP = 1 - Math.pow(1 - clampedProgress, 3);

    // Dynamic scroll unroll: spins into view, raises up, and unrolls from deeper space
    const scrollRotY = (1 - easeP) * Math.PI * 2.5; // ~450 degrees of smooth unroll spin
    const scrollRotX = (1 - easeP) * -0.55; // dramatic initial tilt
    const scrollZ = (1 - easeP) * -4.5;
    const scrollY = (1 - easeP) * -1.2;
    const animScale = THREE.MathUtils.lerp(0.48, 1.0, easeP);

    if (groupRef.current) {
      groupRef.current.scale.setScalar(animScale);
      groupRef.current.position.z = scrollZ;
      groupRef.current.position.y = scrollY;

      // Base gentle auto-rotation (blended in as easeP approaches 1) + scroll unroll + interactive drag offset
      groupRef.current.rotation.x = (0.12 + Math.sin(t * 0.4) * 0.08) * easeP + scrollRotX + rot.x;
      groupRef.current.rotation.y = (t * 0.35 * easeP) + scrollRotY + rot.y;
    }
  });

  return (
    <Float speed={2.2} rotationIntensity={0.3} floatIntensity={0.6}>
      <group ref={groupRef}>
        <Center>
          {/* Rotate +90deg on X to bring geometry upright */}
          <primitive object={clonedScene} rotation={[Math.PI / 2, 0, 0]} scale={scale} />
        </Center>
      </group>
    </Float>
  );
}

// Procedural 3D Fallback in case GLB is loading or WebGL unavailable
function ProceduralFallback({ isDark }: { isDark: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
      meshRef.current.rotation.x += delta * 0.25;
    }
  });

  return (
    <Float speed={2.5} rotationIntensity={0.5} floatIntensity={0.8}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[2.2, 0]} />
        <meshStandardMaterial
          color="#00D639"
          roughness={0.2}
          metalness={0.8}
          wireframe={!isDark}
          emissive="#003b0f"
          emissiveIntensity={0.4}
        />
      </mesh>
    </Float>
  );
}

export interface Optrizo3DLogoProps {
  className?: string;
  scale?: number;
  scrollProgress?: { get: () => number };
}

export default function Optrizo3DLogo({ className, scale = 1.32, scrollProgress }: Optrizo3DLogoProps) {
  const [mounted, setMounted] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [isDark, setIsDark] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    setMounted(true);
    setHasWebGL(isWebGLAvailable());

    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkTheme();

    window.addEventListener("optrizo-theme-change", checkTheme);
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      window.removeEventListener("optrizo-theme-change", checkTheme);
      observer.disconnect();
    };
  }, []);

  // Pointer drag interaction handlers for 360 rotation
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (containerRef.current) {
      containerRef.current.style.cursor = "grabbing";
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    rotationRef.current.targetY += deltaX * 0.008;
    rotationRef.current.targetX += deltaY * 0.008;
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = "grab";
    }
  };

  if (!mounted) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center", className)}>
        <div className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={cn(
        "relative w-full h-full cursor-grab select-none touch-none flex items-center justify-center overflow-visible",
        className
      )}
    >
      {/* Radiant Electric Green Background Glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,214,57,0.22)_0%,rgba(0,214,57,0.06)_45%,transparent_70%)] blur-2xl transform scale-125"
        aria-hidden="true"
      />

      {hasWebGL ? (
        <Canvas
          shadows
          dpr={[1, 1.5]}
          gl={{
            powerPreference: "default",
            antialias: true,
            alpha: true,
            depth: true,
          }}
          camera={{ position: [0, 0, 21], fov: 36 }}
          className="size-full !absolute inset-0"
        >
          <ambientLight intensity={isDark ? 0.35 : 0.65} />
          {/* Front illumination key light */}
          <directionalLight
            position={[0, 8, 24]}
            intensity={isDark ? 2.8 : 3.2}
            castShadow
            shadow-mapSize={[512, 512]}
          />
          {/* Top-right specular light */}
          <directionalLight
            position={[16, 18, 16]}
            intensity={isDark ? 2.2 : 2.6}
          />
          {/* Bottom-left fill light */}
          <directionalLight position={[-14, -8, 12]} intensity={isDark ? 1.0 : 1.2} />
          <pointLight position={[12, -6, 12]} intensity={2.0} color="#00D639" distance={40} />
          <pointLight position={[-12, 12, 10]} intensity={1.4} color="#ffffff" distance={40} />

          <Suspense fallback={<ProceduralFallback isDark={isDark} />}>
            <OptrizoModel isDark={isDark} scale={scale} rotationRef={rotationRef} scrollProgress={scrollProgress} />
          </Suspense>
        </Canvas>
      ) : (
        <div className="relative w-40 h-40 flex items-center justify-center">
          <svg width="80" height="80" viewBox="0 0 24 26" fill="none" className="text-primary animate-pulse">
            <path d="M12 1L22 6.77V19.23L12 25L2 19.23V6.77L12 1Z" stroke="#00D639" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M7 16V12M12 18V8M17 16V10" stroke="#00D639" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* Interactive Drag Hint Monospace Badge */}
      <div className="pointer-events-none absolute bottom-2 right-4 px-2.5 py-1 rounded-full border border-border/80 bg-background/70 backdrop-blur-md text-[10px] font-mono tracking-widest uppercase text-muted-foreground shadow-xs">
        DRAG // 360°
      </div>
    </div>
  );
}

// Preload 3D Model asset
if (typeof window !== "undefined") {
  useGLTF.preload("/models/optrizo-3d-model.glb");
}
