'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function AuroraRing({
  beatHit = 0,
  bassStrength = 0,
  expansion = 0,
}) {
  const ringRef = useRef();
  const materialRef = useRef();

  // Internal beat envelope (THIS fixes 1e-323)
  const beatEnvelopeRef = useRef(0);

  const SEGMENTS = 256;
  const BASE_RADIUS = 22;

  // Geometry: two vertices per segment (bar)
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(SEGMENTS * 2 * 3);
    const colors = new Float32Array(SEGMENTS * 2 * 3);

    for (let i = 0; i < SEGMENTS; i++) {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      const x = Math.cos(angle) * BASE_RADIUS;
      const z = Math.sin(angle) * BASE_RADIUS;

      // Inner point
      positions.set([x, 0, z], i * 6);

      // Outer point (animated later)
      positions.set([x, 0, z], i * 6 + 3);

      // Color (pink → purple aurora)
      const t = i / SEGMENTS;
      const r = 1.0;
      const g = 0.4 + Math.sin(t * Math.PI * 2) * 0.3;
      const b = 1.0;

      colors.set([r, g, b, r, g, b], i * 6);
    }

    return { positions, colors };
  }, []);

  useFrame((_, delta) => {
    if (!ringRef.current) return;

    /* ===========================
       BEAT ENVELOPE (CRITICAL)
       =========================== */

    if (beatHit > 0.1) {
      // HARD ATTACK
      beatEnvelopeRef.current = Math.min(
        beatEnvelopeRef.current + beatHit * 6,
        12
      );
    } else {
      // FAST DECAY
      beatEnvelopeRef.current *= 0.001;
      if (beatEnvelopeRef.current < 0.001) {
        beatEnvelopeRef.current = 0;
      }
    }

    const beatEnv = beatEnvelopeRef.current;
    // console.log(beatHit)
    /* ===========================
       BAR UPDATE
       =========================== */

    const pos = ringRef.current.geometry.attributes.position.array;

    for (let i = 0; i < SEGMENTS; i++) {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      

      // Energy driving the bar
      const floor = 0.02;
      let b = Math.max(0, bassStrength - floor - 0.4);
      b = THREE.MathUtils.clamp(b / (1.0 - floor), 0, 1);
        
      const energy = b * 3.0;
      const barHeight = energy * 2.5;


      const innerRadius = BASE_RADIUS - barHeight * 0.25;
      const outerRadius = BASE_RADIUS + barHeight;

      // Inner vertex
      pos[i * 6 + 0] = cos * innerRadius;
      pos[i * 6 + 1] = -barHeight * 0.15;
      pos[i * 6 + 2] = sin * innerRadius;

      // Outer vertex
      pos[i * 6 + 3] = cos * outerRadius;
      pos[i * 6 + 4] = barHeight;
      pos[i * 6 + 5] = sin * outerRadius;
    }

    ringRef.current.geometry.attributes.position.needsUpdate = true;

    /* ===========================
       MATERIAL / MOTION
       =========================== */

    if (materialRef.current) {
      materialRef.current.opacity = THREE.MathUtils.clamp(
        0.5 + beatEnv * 0.08,
        0.4,
        1.0
      );
    }

    ringRef.current.rotation.y += delta * 0.1;
  });
  return (
    <lineSegments ref={ringRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>

      <lineBasicMaterial
        ref={materialRef}
        vertexColors
        transparent
        linewidth={2}
        opacity={0.85}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}
