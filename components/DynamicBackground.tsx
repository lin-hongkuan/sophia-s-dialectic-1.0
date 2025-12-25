import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, Torus, Stars, Environment } from '@react-three/drei';
import * as THREE from 'three';

// Fix for TypeScript errors regarding missing R3F intrinsic elements
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      meshStandardMaterial: any;
      ambientLight: any;
      pointLight: any;
    }
  }
}

// Fallback for global JSX namespace if needed
declare global {
  namespace JSX {
    interface IntrinsicElements {
      meshStandardMaterial: any;
      ambientLight: any;
      pointLight: any;
    }
  }
}

/**
 * Responsive Camera Controller
 * Adjusts camera position based on screen width to prevent the 3D scene from
 * looking too "zoomed in" on mobile devices.
 */
const ResponsiveCamera = () => {
  const { camera, size } = useThree();

  useEffect(() => {
    // If width is less than 768px (standard mobile breakpoint), move camera back
    const isMobile = size.width < 768;
    // Desktop Z: 6, Mobile Z: 11 (Further away makes objects look smaller)
    const targetZ = isMobile ? 11 : 6;
    
    camera.position.z = targetZ;
    camera.updateProjectionMatrix();
  }, [size.width, camera]);

  return null;
};

/**
 * 单个量子粒子组件
 * 使用 MeshDistortMaterial 实现扭曲效果
 */
const QuantumParticle = ({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) => {
  const ref = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.getElapsedTime();
      // 上下浮动 + 旋转动画
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
        distort={0.4} // 扭曲强度
        speed={2}     // 扭曲速度
      />
    </Sphere>
  );
};

/**
 * 宏观波形组件 (背景中的金色圆环)
 */
const MacroscopicWave = () => {
  const ref = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ref.current) {
       const t = state.clock.getElapsedTime();
       // 缓慢旋转效果
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
      />
    </Torus>
  );
}

/**
 * 主场景组件
 */
export const BackgroundScene: React.FC = () => {
  return (
    // 使用 fixed inset-0 充满视口，确保背景不随内容高度变化而拉伸
    <div className="fixed inset-0 z-0 opacity-30 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
        <ResponsiveCamera />
        {/* 灯光设置 */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        {/* 第一组浮动粒子 */}
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
          <QuantumParticle position={[0, 0, 0]} color="#4F46E5" scale={1.2} />
          <MacroscopicWave />
        </Float>
        
        {/* 第二组浮动粒子 (分散在周围) */}
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
           <QuantumParticle position={[-3, 1, -2]} color="#9333EA" scale={0.5} />
           <QuantumParticle position={[3, -1, -3]} color="#C5A059" scale={0.6} />
        </Float>

        {/* 环境光照 (让金属材质反光) */}
        <Environment preset="city" />
        
        {/* 星空背景 */}
        <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
      </Canvas>
    </div>
  );
};

export default BackgroundScene;