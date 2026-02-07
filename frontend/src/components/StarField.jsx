'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function StarField({ beatHit = 0, expansion = 0 }) {
  const starsRef = useRef();
  const beatStateRef = useRef({
    sizeMultiplier: 1,
  });

  // Generate stars in a sphere around the scene
  const { positions, starCount } = useMemo(() => {
    const STAR_COUNT = 3000;
    const positions = new Float32Array(STAR_COUNT * 3);
    const radius = 150; // Distance from center
    
    for (let i = 0; i < STAR_COUNT; i++) {
      // Distribute stars evenly in a sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const r = radius + Math.random() * 50; // Add some depth variation
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    
    return { positions, starCount: STAR_COUNT };
  }, []);

  useFrame((state, delta) => {
    if (!starsRef.current) return;
    
    const beatState = beatStateRef.current;
    
    // React to beats with fast attack, very slow decay
    const targetSize = 1 + beatHit * 0.8 + expansion * 0.3;
    beatState.sizeMultiplier = THREE.MathUtils.lerp(beatState.sizeMultiplier, targetSize, 0.25);
    
    // Very slow decay when no beat
    if (beatHit < 0.1 && expansion < 0.1) {
      beatState.sizeMultiplier = THREE.MathUtils.lerp(beatState.sizeMultiplier, 1, 0.015);
    }
    
    // Update star size based on beat
    if (starsRef.current.material) {
      starsRef.current.material.size = 0.4 * beatState.sizeMultiplier;
    }
    
    // Subtle rotation
    starsRef.current.rotation.y += delta * 0.003;
  });

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={starCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.4}
        color="#ffffff"
        transparent
        opacity={0.7}
        depthWrite={false}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
