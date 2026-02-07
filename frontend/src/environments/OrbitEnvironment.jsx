'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Sandstorm orbit - particles swirl around the visualizer in chaotic orbits
export default function OrbitEnvironment({ opacity = 1, hue = 0.78, saturation = 1.0, lightness = 0.6 }) {
  const ref = useRef();
  const matRef = useRef();
  const timeRef = useRef(0);

  const COUNT = 800;

  // Each particle has its own orbital parameters
  const orbits = useMemo(() => {
    const data = [];
    for (let i = 0; i < COUNT; i++) {
      data.push({
        radius: 12 + Math.random() * 40,
        speed: (0.3 + Math.random() * 0.7) * (Math.random() > 0.5 ? 1 : -1),
        inclination: (Math.random() - 0.5) * Math.PI * 0.8, // tilt of orbit plane
        phase: Math.random() * Math.PI * 2,
        wobble: Math.random() * 3, // vertical wobble amplitude
        wobbleSpeed: 0.5 + Math.random() * 1.5,
        eccentricity: 0.7 + Math.random() * 0.3, // how elliptical
      });
    }
    return data;
  }, []);

  const positions = useMemo(() => new Float32Array(COUNT * 3), []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    timeRef.current += delta;
    const t = timeRef.current;

    const arr = ref.current.geometry.attributes.position.array;

    for (let i = 0; i < COUNT; i++) {
      const o = orbits[i];
      const angle = o.phase + t * o.speed;
      const r = o.radius * (1 + (1 - o.eccentricity) * Math.sin(angle * 2));

      // Orbit in a tilted plane
      const cosInc = Math.cos(o.inclination);
      const sinInc = Math.sin(o.inclination);

      const x = Math.cos(angle) * r;
      const flatZ = Math.sin(angle) * r;
      const wobble = Math.sin(t * o.wobbleSpeed + o.phase) * o.wobble;

      // Rotate by inclination around X axis
      arr[i * 3] = x;
      arr[i * 3 + 1] = flatZ * sinInc + wobble;
      arr[i * 3 + 2] = flatZ * cosInc;
    }

    ref.current.geometry.attributes.position.needsUpdate = true;

    if (matRef.current) {
      matRef.current.opacity = opacity * 0.55;
      matRef.current.color.setHSL(hue, saturation * 0.7, lightness + 0.1);
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={0.25}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
