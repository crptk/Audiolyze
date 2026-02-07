'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function StarField({ beatHit = 0, expansion = 0 }) {
  const pointsRef = useRef();

  // Internal beat envelope (fast attack, fast decay)
  const beatEnvelopeRef = useRef(0);

  const { positions, sizes, starCount } = useMemo(() => {
    const STAR_COUNT = 3000;
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);

    const radius = 150;

    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = radius + Math.random() * 50;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Per-star base size
      sizes[i] = Math.random() * 1.2 + 0.3;
    }

    return { positions, sizes, starCount: STAR_COUNT };
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    // FAST ATTACK
    if (beatHit > 0.1) {
      beatEnvelopeRef.current = Math.min(
        beatEnvelopeRef.current + beatHit * 6,
        12
      );
    } else {
      // FAST DECAY
      beatEnvelopeRef.current = THREE.MathUtils.lerp(
        beatEnvelopeRef.current,
        0,
        0.35
      );
    }

    pointsRef.current.material.uniforms.uBeat.value =
      beatEnvelopeRef.current;

    // Subtle slow drift
    pointsRef.current.rotation.y += delta * 0.002;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={starCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={starCount}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>

      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uBeat: { value: 0 },
        }}
        vertexShader={`
          attribute float aSize;
          uniform float uBeat;

          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

            float beatBoost = clamp(uBeat, 0.0, 12.0);
            float size = aSize * (1.0 + beatBoost * 2.5);

            gl_PointSize = size * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;

            float alpha = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vec3(1.0), alpha);
          }
        `}
      />
    </points>
  );
}
