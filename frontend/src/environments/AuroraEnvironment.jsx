'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Aurora borealis - ribbons of particles flowing in smooth curves around the visualizer
export default function AuroraEnvironment({ opacity = 1, hue = 0.78, saturation = 1.0, lightness = 0.6 }) {
  const ref = useRef();
  const matRef = useRef();
  const timeRef = useRef(0);

  // Multiple ribbons, each is a stream of particles following a path
  const RIBBON_COUNT = 6;
  const PARTICLES_PER_RIBBON = 120;
  const COUNT = RIBBON_COUNT * PARTICLES_PER_RIBBON;

  const ribbonParams = useMemo(() => {
    const params = [];
    for (let r = 0; r < RIBBON_COUNT; r++) {
      params.push({
        baseRadius: 18 + r * 6,
        height: -8 + r * 3.5,
        speed: (0.4 + Math.random() * 0.3) * (r % 2 === 0 ? 1 : -1),
        waveAmp: 3 + Math.random() * 5,
        waveFreq: 2 + Math.random() * 3,
        verticalWave: 2 + Math.random() * 4,
        phase: (r / RIBBON_COUNT) * Math.PI * 2,
        tilt: (Math.random() - 0.5) * 0.4, // slight tilt
      });
    }
    return params;
  }, []);

  const positions = useMemo(() => new Float32Array(COUNT * 3), []);
  const colors = useMemo(() => {
    const c = new Float32Array(COUNT * 3);
    // Initialize with base colors per ribbon
    for (let r = 0; r < RIBBON_COUNT; r++) {
      for (let p = 0; p < PARTICLES_PER_RIBBON; p++) {
        const idx = (r * PARTICLES_PER_RIBBON + p) * 3;
        const t = p / PARTICLES_PER_RIBBON;
        // Fade at head and tail of ribbon
        const fade = Math.sin(t * Math.PI);
        c[idx] = fade;
        c[idx + 1] = fade;
        c[idx + 2] = fade;
      }
    }
    return c;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    timeRef.current += delta;
    const t = timeRef.current;

    const arr = ref.current.geometry.attributes.position.array;
    const col = ref.current.geometry.attributes.color.array;

    for (let r = 0; r < RIBBON_COUNT; r++) {
      const rp = ribbonParams[r];
      for (let p = 0; p < PARTICLES_PER_RIBBON; p++) {
        const idx = (r * PARTICLES_PER_RIBBON + p) * 3;
        const pFrac = p / PARTICLES_PER_RIBBON;

        // Each particle is at a different position along the ribbon path
        const angle = rp.phase + t * rp.speed + pFrac * Math.PI * 2;
        const radiusWobble = Math.sin(angle * rp.waveFreq) * rp.waveAmp;
        const radius = rp.baseRadius + radiusWobble;

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = rp.height + Math.sin(angle * 2 + t * 0.5) * rp.verticalWave;

        // Apply tilt
        arr[idx] = x;
        arr[idx + 1] = y + z * rp.tilt;
        arr[idx + 2] = z;

        // Color: fade at edges of ribbon, shift hue along length
        const fade = Math.sin(pFrac * Math.PI);
        const ribbonHue = hue + (r / RIBBON_COUNT) * 0.15 + pFrac * 0.05;
        const c = new THREE.Color().setHSL(ribbonHue, saturation * 0.85, lightness + 0.1);
        col[idx] = c.r * fade;
        col[idx + 1] = c.g * fade;
        col[idx + 2] = c.b * fade;
      }
    }

    ref.current.geometry.attributes.position.needsUpdate = true;
    ref.current.geometry.attributes.color.needsUpdate = true;

    if (matRef.current) {
      matRef.current.opacity = opacity * 0.6;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={COUNT} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={0.35}
        vertexColors
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
