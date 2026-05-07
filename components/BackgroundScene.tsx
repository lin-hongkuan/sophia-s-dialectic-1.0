import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Float, MeshDistortMaterial, Sphere, Stars, Torus } from '@react-three/drei';
import * as THREE from 'three';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      meshStandardMaterial: any;
      ambientLight: any;
      pointLight: any;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      meshStandardMaterial: any;
      ambientLight: any;
      pointLight: any;
    }
  }
}

// Local copy of the same HDR that drei's `Environment preset="city"` fetches remotely
// (potsdamer_platz_1k.hdr). Bundled under public/hdri/ so we never hit a foreign CDN at runtime.
const CITY_HDR_URL = '/hdri/potsdamer_platz_1k.hdr';

// Front-occlusion: a y-axis-facing plane that clips the wave so its near half can render in front
// of the home page hero text (mirrors the original effect 1:1).
const FRONT_CLIPPING_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

// Shared GL options: low-power preference + tolerance for weak GPUs reduces context-loss churn,
// especially in dev (StrictMode double-mounts each Canvas) and on integrated GPUs.
const GL_OPTIONS = {
  antialias: true,
  alpha: true,
  powerPreference: 'low-power' as const,
  failIfMajorPerformanceCaveat: false,
  preserveDrawingBuffer: false,
};

// Three.js itself calls preventDefault on contextlost so the browser is allowed to restore the
// context, but it still prints "THREE.WebGLRenderer: Context Lost." once per loss. Adding our
// own listener lets us also catch contextcreationerror (which three doesn't log) and gives us
// a hook for future restore-time work.
const attachContextHandlers = (gl: THREE.WebGLRenderer, onUnavailable?: () => void) => {
  const canvas = gl.domElement;
  const onLost = (event: Event) => {
    event.preventDefault();
    onUnavailable?.();
  };
  const onCreationError = (event: Event) => {
    event.preventDefault();
    onUnavailable?.();
  };
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextcreationerror', onCreationError, false);
};

const ResponsiveCamera = () => {
  const { camera, size } = useThree();

  useEffect(() => {
    const isMobile = size.width < 768;
    const targetZ = isMobile ? 11 : 6;
    camera.position.z = targetZ;
    camera.updateProjectionMatrix();
  }, [size.width, camera]);

  return null;
};

const QuantumParticle = ({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) => {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (ref.current) {
      const t = performance.now() / 1000;
      ref.current.position.y = position[1] + Math.sin(t * 2 + position[0]) * 0.2;
      ref.current.rotation.x = t * 0.5;
      ref.current.rotation.z = t * 0.3;
    }
  });

  return (
    <Sphere ref={ref} args={[1, 32, 32]} position={position} scale={scale}>
      <MeshDistortMaterial
        color={color}
        envMapIntensity={1}
        clearcoat={1}
        clearcoatRoughness={0}
        metalness={0.5}
        distort={0.4}
        speed={2}
      />
    </Sphere>
  );
};

const MacroscopicWave = ({ frontOnly = false }: { frontOnly?: boolean }) => {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (ref.current) {
      const t = performance.now() / 1000;
      ref.current.position.y = Math.sin(t * 1.5) * 0.12;
      ref.current.rotation.x = Math.sin(t * 0.2) * 0.2;
      ref.current.rotation.y = t * 0.1;
    }
  });

  return (
    <Torus ref={ref} args={[3, 0.1, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        color="#C5A059"
        emissive="#C5A059"
        emissiveIntensity={0.5}
        transparent
        opacity={0.6}
        wireframe
        depthWrite={!frontOnly}
        clippingPlanes={frontOnly ? [FRONT_CLIPPING_PLANE] : undefined}
      />
    </Torus>
  );
};

interface BackgroundSceneProps {
  showFrontOcclusion?: boolean;
  onUnavailable?: () => void;
}

const BackgroundScene: React.FC<BackgroundSceneProps> = ({ showFrontOcclusion = false, onUnavailable }) => {
  // Pause both Canvases when the tab is hidden so the GPU isn't burning cycles in the background.
  // This is the only behavioral change vs. the original (the original ran at 60fps even when hidden);
  // it is invisible to the user when the tab is foregrounded.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const handle = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, []);
  const frameloop = paused ? 'never' : 'always';

  return (
    <>
      <div className="fixed inset-0 z-0 opacity-30 pointer-events-none">
        <Canvas
          camera={{ position: [0, 0, 6], fov: 45 }}
          frameloop={frameloop}
          gl={GL_OPTIONS}
          style={{ pointerEvents: 'none' }}
          onCreated={({ gl }) => attachContextHandlers(gl, onUnavailable)}
        >
          <ResponsiveCamera />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />

          <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
            <QuantumParticle position={[0, 0, 0]} color="#4F46E5" scale={1.2} />
          </Float>

          <MacroscopicWave />

          <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <QuantumParticle position={[-3, 1, -2]} color="#9333EA" scale={0.5} />
            <QuantumParticle position={[3, -1, -3]} color="#C5A059" scale={0.6} />
          </Float>

          <Environment files={CITY_HDR_URL} />
          <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
        </Canvas>
      </div>

      {showFrontOcclusion && (
        <div className="fixed inset-0 z-20 opacity-30 pointer-events-none">
          <Canvas
            camera={{ position: [0, 0, 6], fov: 45 }}
            gl={GL_OPTIONS}
            frameloop={frameloop}
            style={{ pointerEvents: 'none' }}
            onCreated={({ gl }) => {
              gl.localClippingEnabled = true;
              attachContextHandlers(gl, onUnavailable);
            }}
          >
            <ResponsiveCamera />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <MacroscopicWave frontOnly />
          </Canvas>
        </div>
      )}
    </>
  );
};

export default BackgroundScene;
