"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, MeshDistortMaterial, useGLTF, Center } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";

// --- Liquid Shader Component for Ambient Cyber Caustics ---
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
      uScroll: { value: 0 },
    }),
    []
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
            
            float scrollFade = clamp(1.0 - uScroll * 1.1, 0.0, 1.0);
            float bottomFalloff = smoothstep(0.08, 0.42, uv.y) * scrollFade;

            vec3 lightBg = vec3(0.965, 0.970, 0.966);
            vec3 lightPearl = mix(lightBg, vec3(0.945, 0.958, 0.948), color * 0.4);
            vec3 lightGreenGlow = vec3(0.0, 0.84, 0.22) * pow(color, 3.5) * 0.05 * bottomFalloff;
            vec3 lightColor = mix(lightBg, lightPearl + lightGreenGlow, bottomFalloff);

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

// --- Procedural 3D Optrizo Logo Model ---
interface OptrizoLogo3DProps {
  isDark: boolean;
  scrollRef?: React.RefObject<number>;
}

const OptrizoLogo3D: React.FC<OptrizoLogo3DProps> = ({ isDark, scrollRef }) => {
  const { viewport } = useThree();
  const isMobile = viewport.width < 25;
  const isTablet = viewport.width >= 25 && viewport.width < 34;
  const baseY = isMobile ? -5.8 : (isTablet ? -2.5 : 0);
  const baseScale: [number, number, number] = isMobile
    ? [0.65, 0.65, 0.65]
    : isTablet
    ? [0.9, 0.9, 0.9]
    : [1.15, 1.15, 1.15];

  const scrollGroupRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);
  const frameRef = useRef<THREE.Mesh>(null);
  const pillarsRef = useRef<THREE.Group>(null);
  const currentScroll = useRef(0);
  const materialsRef = useRef<THREE.Material[]>([]);

  const { frameGeometry, pillar1Geo, pillar2Geo, pillar3Geo } = useMemo(() => {
    const frameShape = new THREE.Shape();
    const R = 9.5;
    const r = 7.6;

    const getHexPoints = (radius: number) => {
      const pts: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
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

    const pillarWidth = 1.35;
    const pillarDepth = 3.0;

    const p1Height = 5.2;
    const p1Geo = new THREE.BoxGeometry(pillarWidth, p1Height, pillarDepth);

    const p2Height = 8.6;
    const p2Geo = new THREE.BoxGeometry(pillarWidth, p2Height, pillarDepth);

    const p3Height = 6.4;
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

    currentScroll.current = THREE.MathUtils.damp(
      currentScroll.current,
      target,
      4.5,
      delta
    );
    const p = currentScroll.current;

    if (scrollGroupRef.current) {
      scrollGroupRef.current.position.y = baseY - p * 28;
      scrollGroupRef.current.position.z = -p * 14;

      const fadeStart = 0.12;
      const fadeEnd = 0.65;
      const fadeRatio = THREE.MathUtils.clamp((p - fadeStart) / (fadeEnd - fadeStart), 0, 1);
      const currentOpacity = 1.0 - fadeRatio;

      materialsRef.current.forEach((mat) => {
        mat.opacity = currentOpacity;
      });

      scrollGroupRef.current.visible = currentOpacity > 0.002;
    }

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.22;
      groupRef.current.rotation.x = Math.sin(t * 0.15) * 0.08 + 0.36;
    }
  });

  return (
    <group ref={scrollGroupRef} position={[0, baseY, 0]}>
      <Float speed={1.8} rotationIntensity={isMobile ? 0.2 : 0.5} floatIntensity={isMobile ? 0.35 : 1.2}>
        <group ref={groupRef} rotation={[0.36, Math.PI / 6, 0]} scale={baseScale}>
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

          <group ref={pillarsRef} position={[0, -0.6, 0]}>
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
  const { viewport } = useThree();
  const isMobile = viewport.width < 25;
  const isTablet = viewport.width >= 25 && viewport.width < 34;
  const baseY = isMobile ? -5.8 : (isTablet ? -2.5 : 0);
  const modelScale = isMobile ? 2.3 : (isTablet ? 3.3 : 4.5);

  const scrollGroupRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);
  const shadowMatRef = useRef<THREE.ShadowMaterial>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const currentScroll = useRef(0);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    const mats: THREE.MeshStandardMaterial[] = [];
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(isDark ? "#00D639" : "#00DF3D"),
          roughness: isDark ? 0.26 : 0.42,
          metalness: isDark ? 0.42 : 0.15,
          emissive: new THREE.Color(isDark ? "#000000" : "#003b0f"),
          emissiveIntensity: isDark ? 0.0 : 0.04,
          transparent: true,
          opacity: 1.0,
          depthWrite: true,
          side: THREE.DoubleSide,
        });
        mesh.material = mat;
        mats.push(mat);
      }
    });
    return { clone, mats };
  }, [scene, isDark]);

  useEffect(() => {
    materialsRef.current = clonedScene.mats;
  }, [clonedScene]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const { mouse } = state;
    const target = scrollRef?.current ?? 0;

    currentScroll.current = THREE.MathUtils.damp(
      currentScroll.current,
      target,
      5.5,
      delta
    );
    const p = currentScroll.current;

    const mouseInfluence = Math.max(0, 1 - p * 1.8);
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.45) * 0.32 + mouse.x * 0.25 * mouseInfluence;
      groupRef.current.rotation.x = Math.sin(t * 0.35) * 0.08 + 0.12 - mouse.y * 0.18 * mouseInfluence;
      groupRef.current.position.y = Math.sin(t * 0.8) * 0.4;
    }

    if (scrollGroupRef.current) {
      scrollGroupRef.current.position.y = baseY - p * 32;
      scrollGroupRef.current.position.z = -p * 20;

      const fadeStart = 0.10;
      const fadeEnd = 0.65;
      const fadeRatio = THREE.MathUtils.clamp((p - fadeStart) / (fadeEnd - fadeStart), 0, 1);
      const currentOpacity = 1.0 - fadeRatio;

      materialsRef.current.forEach((mat) => {
        mat.opacity = currentOpacity;
        mat.depthWrite = currentOpacity > 0.85;
      });

      scrollGroupRef.current.visible = currentOpacity > 0.002;

      if (shadowMatRef.current) {
        const baseShadow = isDark ? 0.40 : (isMobile ? 0.06 : 0.14);
        shadowMatRef.current.opacity = baseShadow * currentOpacity;
      }
    }
  });

  return (
    <>
      <group ref={scrollGroupRef} position={[0, baseY, 0]}>
        <Float speed={1.6} rotationIntensity={isMobile ? 0.15 : 0.3} floatIntensity={isMobile ? 0.35 : 0.8}>
          <group ref={groupRef}>
            <Center>
              <primitive object={clonedScene.clone} rotation={[Math.PI / 2, 0, 0]} scale={modelScale} />
            </Center>
          </group>
        </Float>
      </group>

      <mesh position={[0, baseY, -6]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial
          ref={shadowMatRef}
          transparent
          opacity={isDark ? 0.40 : (isMobile ? 0.06 : 0.14)}
          color={isDark ? "#000000" : "#001a06"}
        />
      </mesh>
    </>
  );
};

export class WebGLErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn("WebGL unavailable:", error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

export default function Hero3DScene({
  isDark,
  scrollRef,
  fallback,
}: {
  isDark: boolean;
  scrollRef?: React.RefObject<number>;
  fallback?: React.ReactNode;
}) {
  return (
    <WebGLErrorBoundary fallback={fallback}>
      <Canvas
        shadows
        dpr={[1, 1.25]}
        gl={{
          powerPreference: "high-performance",
          antialias: false,
          alpha: true,
          stencil: false,
          depth: true,
          failIfMajorPerformanceCaveat: false,
        }}
        camera={{ position: [0, 0, 60], fov: 35 }}
      >
        <ambientLight intensity={isDark ? 0.22 : 0.65} />
        <directionalLight
          position={[12, 26, 48]}
          intensity={isDark ? 3.4 : 3.5}
          castShadow
          shadow-mapSize={[512, 512]}
          shadow-camera-near={10}
          shadow-camera-far={90}
          shadow-camera-left={-22}
          shadow-camera-right={22}
          shadow-camera-top={22}
          shadow-camera-bottom={-22}
          shadow-bias={-0.0002}
          shadow-normalBias={0.03}
          shadow-radius={3.0}
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
        <LiquidBackground isDark={isDark} scrollRef={scrollRef} />
        <React.Suspense fallback={<OptrizoLogo3D isDark={isDark} scrollRef={scrollRef} />}>
          <OptrizoLogoModel isDark={isDark} scrollRef={scrollRef} />
        </React.Suspense>
      </Canvas>
    </WebGLErrorBoundary>
  );
}
