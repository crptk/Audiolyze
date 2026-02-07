'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Hyperspace warp - particles rush past the camera in a tunnel
export default function WarpEnvironment({ opacity = 1, hue = 0.78, saturation = 1.0, lightness = 0.6 }) {
  const particlesRef = useRef();
  const streaksRef = useRef();
  const matRef = useRef();
  const streakMatRef = useRef();

  const COUNT = 500;
  const STREAK_COUNT = 40;
  const SPEED = 1.8;

  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const spd = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 55;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = Math.sin(angle) * r;
      pos[i * 3 + 2] = -200 + Math.random() * 260;
      spd[i] = 0.6 + Math.random() * 0.8;
    }
    return { positions: pos, speeds: spd };
  }, []);

  const { streakPos, streakColors, streakSpeeds } = useMemo(() => {
    const pos = new Float32Array(STREAK_COUNT * 6);
    const col = new Float32Array(STREAK_COUNT * 6);
    const spd = new Float32Array(STREAK_COUNT);
    for (let i = 0; i < STREAK_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 15 + Math.random() * 45;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      const z = -200 + Math.random() * 260;
      const len = 15 + Math.random() * 25;
      pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x; pos[i * 6 + 4] = y; pos[i * 6 + 5] = z - len;
      const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.8, 0.7);
      const t = new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.6, 0.3);
      col[i * 6] = c.r; col[i * 6 + 1] = c.g; col[i * 6 + 2] = c.b;
      col[i * 6 + 3] = t.r; col[i * 6 + 4] = t.g; col[i * 6 + 5] = t.b;
      spd[i] = 0.8 + Math.random() * 0.6;
    }
    return { streakPos: pos, streakColors: col, streakSpeeds: spd };
  }, []);

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.opacity = opacity * 0.7;
      matRef.current.color.setHSL(hue, saturation, lightness + 0.2);
    }
    if (streakMatRef.current) {
      streakMatRef.current.opacity = opacity * 0.6;
    }

    if (particlesRef.current) {
      const p = particlesRef.current.geometry.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        p[i * 3 + 2] += SPEED * speeds[i] * delta * 60;
        if (p[i * 3 + 2] > 80) {
          const a = Math.random() * Math.PI * 2;
          const r = 8 + Math.random() * 55;
          p[i * 3] = Math.cos(a) * r;
          p[i * 3 + 1] = Math.sin(a) * r;
          p[i * 3 + 2] = -180 - Math.random() * 60;
        }
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }

    if (streaksRef.current) {
      const p = streaksRef.current.geometry.attributes.position.array;
      const c = streaksRef.current.geometry.attributes.color.array;
      for (let i = 0; i < STREAK_COUNT; i++) {
        const mv = SPEED * streakSpeeds[i] * delta * 60;
        p[i * 6 + 2] += mv;
        p[i * 6 + 5] += mv;
        if (p[i * 6 + 2] > 80) {
          const a = Math.random() * Math.PI * 2;
          const r = 15 + Math.random() * 45;
          const len = 15 + Math.random() * 25;
          const z = -180 - Math.random() * 60;
          p[i * 6] = Math.cos(a) * r; p[i * 6 + 1] = Math.sin(a) * r; p[i * 6 + 2] = z;
          p[i * 6 + 3] = p[i * 6]; p[i * 6 + 4] = p[i * 6 + 1]; p[i * 6 + 5] = z - len;
        }
        // Update colors to match visualizer
        const hv = hue + (Math.sin(i * 0.5) * 0.05);
        const hc = new THREE.Color().setHSL(hv, saturation * 0.8, lightness + 0.15);
        const tc = new THREE.Color().setHSL(hv, saturation * 0.6, lightness * 0.5);
        c[i * 6] = hc.r; c[i * 6 + 1] = hc.g; c[i * 6 + 2] = hc.b;
        c[i * 6 + 3] = tc.r; c[i * 6 + 4] = tc.g; c[i * 6 + 5] = tc.b;
      }
      streaksRef.current.geometry.attributes.position.needsUpdate = true;
      streaksRef.current.geometry.attributes.color.needsUpdate = true;
    }
  });

  return (
    <group>
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial ref={matRef} size={0.4} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <lineSegments ref={streaksRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={STREAK_COUNT * 2} array={streakPos} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={STREAK_COUNT * 2} array={streakColors} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial ref={streakMatRef} vertexColors transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
}
