'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Fireflies - scattered glowing particles that drift gently and pulse with audio
export default function FirefliesEnvironment({ opacity = 1, hue = 0.78, saturation = 1.0, lightness = 0.6 }) {
  const ref = useRef();
  const matRef = useRef();
  const timeRef = useRef(0);

  const COUNT = 300;

  const particles = useMemo(() => {
    const data = [];
    for (let i = 0; i < COUNT; i++) {
      // Spread in a large sphere around the visualizer
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 15 + Math.random() * 50;
      data.push({
        baseX: Math.sin(phi) * Math.cos(theta) * r,
        baseY: Math.sin(phi) * Math.sin(theta) * r,
        baseZ: Math.cos(phi) * r,
        driftSpeed: 0.2 + Math.random() * 0.5,
        driftRadius: 1 + Math.random() * 4,
        pulseSpeed: 0.5 + Math.random() * 2,
        pulsePhase: Math.random() * Math.PI * 2,
        driftPhaseX: Math.random() * Math.PI * 2,
        driftPhaseY: Math.random() * Math.PI * 2,
        driftPhaseZ: Math.random() * Math.PI * 2,
      });
    }
    return data;
  }, []);

  const positions = useMemo(() => new Float32Array(COUNT * 3), []);
  const sizes = useMemo(() => {
    const s = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      s[i] = 0.3 + Math.random() * 0.5;
    }
    return s;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    timeRef.current += delta;
    const t = timeRef.current;

    const arr = ref.current.geometry.attributes.position.array;

    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      // Gentle drift around base position
      const dx = Math.sin(t * p.driftSpeed + p.driftPhaseX) * p.driftRadius;
      const dy = Math.cos(t * p.driftSpeed * 0.7 + p.driftPhaseY) * p.driftRadius * 0.6;
      const dz = Math.sin(t * p.driftSpeed * 0.5 + p.driftPhaseZ) * p.driftRadius;

      arr[i * 3] = p.baseX + dx;
      arr[i * 3 + 1] = p.baseY + dy;
      arr[i * 3 + 2] = p.baseZ + dz;
    }

    ref.current.geometry.attributes.position.needsUpdate = true;

    if (matRef.current) {
      // Gentle pulsing of overall opacity
      const pulse = 0.8 + Math.sin(t * 0.5) * 0.2;
      matRef.current.opacity = opacity * 0.5 * pulse;
      matRef.current.color.setHSL(hue + 0.05, saturation * 0.6, lightness + 0.25);
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={0.6}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
