'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Rain - particles streaming downward, gently drifting, audio-reactive fall speed
export default function RainEnvironment({ opacity = 1, hue = 0.78, saturation = 1.0, lightness = 0.6 }) {
  const ref = useRef();
  const streakRef = useRef();
  const matRef = useRef();
  const streakMatRef = useRef();

  const DOT_COUNT = 500;
  const STREAK_COUNT = 60;

  const { dotPositions, dotSpeeds } = useMemo(() => {
    const pos = new Float32Array(DOT_COUNT * 3);
    const spd = new Float32Array(DOT_COUNT);
    for (let i = 0; i < DOT_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 120;
      pos[i * 3 + 1] = Math.random() * 80 - 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
      spd[i] = 0.4 + Math.random() * 0.8;
    }
    return { dotPositions: pos, dotSpeeds: spd };
  }, []);

  const { streakPositions, streakColors, streakSpeeds } = useMemo(() => {
    const pos = new Float32Array(STREAK_COUNT * 6);
    const col = new Float32Array(STREAK_COUNT * 6);
    const spd = new Float32Array(STREAK_COUNT);
    for (let i = 0; i < STREAK_COUNT; i++) {
      const x = (Math.random() - 0.5) * 100;
      const y = Math.random() * 80;
      const z = (Math.random() - 0.5) * 100;
      const len = 2 + Math.random() * 5;
      pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x + (Math.random() - 0.5) * 0.3;
      pos[i * 6 + 4] = y + len;
      pos[i * 6 + 5] = z + (Math.random() - 0.5) * 0.3;
      // Head bright, tail dim
      col[i * 6] = 0.7; col[i * 6 + 1] = 0.8; col[i * 6 + 2] = 1.0;
      col[i * 6 + 3] = 0.2; col[i * 6 + 4] = 0.3; col[i * 6 + 5] = 0.5;
      spd[i] = 0.6 + Math.random() * 1.0;
    }
    return { streakPositions: pos, streakColors: col, streakSpeeds: spd };
  }, []);

  useFrame((_, delta) => {
    const fallSpeed = 15;

    // Dot rain
    if (ref.current) {
      const p = ref.current.geometry.attributes.position.array;
      for (let i = 0; i < DOT_COUNT; i++) {
        p[i * 3 + 1] -= fallSpeed * dotSpeeds[i] * delta;
        // Gentle horizontal drift
        p[i * 3] += Math.sin(p[i * 3 + 1] * 0.1 + i) * delta * 0.3;
        if (p[i * 3 + 1] < -30) {
          p[i * 3] = (Math.random() - 0.5) * 120;
          p[i * 3 + 1] = 60 + Math.random() * 20;
          p[i * 3 + 2] = (Math.random() - 0.5) * 120;
        }
      }
      ref.current.geometry.attributes.position.needsUpdate = true;
    }

    // Streak rain
    if (streakRef.current) {
      const p = streakRef.current.geometry.attributes.position.array;
      const c = streakRef.current.geometry.attributes.color.array;
      for (let i = 0; i < STREAK_COUNT; i++) {
        const fall = fallSpeed * streakSpeeds[i] * delta;
        p[i * 6 + 1] -= fall;
        p[i * 6 + 4] -= fall;
        if (p[i * 6 + 1] < -30) {
          const x = (Math.random() - 0.5) * 100;
          const y = 60 + Math.random() * 20;
          const z = (Math.random() - 0.5) * 100;
          const len = 2 + Math.random() * 5;
          p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z;
          p[i * 6 + 3] = x; p[i * 6 + 4] = y + len; p[i * 6 + 5] = z;
        }
        // Color match
        const hc = new THREE.Color().setHSL(hue + 0.1, saturation * 0.5, lightness + 0.2);
        const tc = new THREE.Color().setHSL(hue + 0.1, saturation * 0.3, lightness * 0.4);
        c[i * 6] = hc.r; c[i * 6 + 1] = hc.g; c[i * 6 + 2] = hc.b;
        c[i * 6 + 3] = tc.r; c[i * 6 + 4] = tc.g; c[i * 6 + 5] = tc.b;
      }
      streakRef.current.geometry.attributes.position.needsUpdate = true;
      streakRef.current.geometry.attributes.color.needsUpdate = true;
    }

    if (matRef.current) {
      matRef.current.opacity = opacity * 0.45;
      matRef.current.color.setHSL(hue + 0.1, saturation * 0.5, lightness + 0.2);
    }
    if (streakMatRef.current) {
      streakMatRef.current.opacity = opacity * 0.4;
    }
  });

  return (
    <group>
      <points ref={ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={DOT_COUNT} array={dotPositions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial ref={matRef} size={0.2} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <lineSegments ref={streakRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={STREAK_COUNT * 2} array={streakPositions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={STREAK_COUNT * 2} array={streakColors} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial ref={streakMatRef} vertexColors transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
}
