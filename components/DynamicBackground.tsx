import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, Torus, Stars, Environment } from '@react-three/drei';
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

const FRONT_CLIPPING_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

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
}

const BackgroundScene: React.FC<BackgroundSceneProps> = ({ showFrontOcclusion = false }) => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(147,51,234,0.12),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(197,160,89,0.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.86),rgba(242,240,235,0.72))]" />
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-0 opacity-30 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 6], fov: 45 }} style={{ pointerEvents: 'none' }}>
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

          <Environment preset="city" />
          <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
        </Canvas>
      </div>

      {showFrontOcclusion && (
        <div className="fixed inset-0 z-20 opacity-30 pointer-events-none">
          <Canvas
            camera={{ position: [0, 0, 6], fov: 45 }}
            gl={{ alpha: true, antialias: true }}
            style={{ pointerEvents: 'none' }}
            onCreated={({ gl }) => {
              gl.localClippingEnabled = true;
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
