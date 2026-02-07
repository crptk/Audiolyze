'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function JourneyMode({ 
  isActive = false,
  journeyProgress = 0,
  visualizerRef = null
}) {
  const particlesRef = useRef();
  const lightStreamsRef = useRef();
  
  const PARTICLE_COUNT = 800;
  const STREAM_COUNT = 40;

  // Flying particles that pass by
  const { particlePositions, particleVelocities } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 50 + Math.random() * 100;
      const height = (Math.random() - 0.5) * 100;
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      
      velocities[i * 3] = (Math.random() - 0.5) * 0.5;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      velocities[i * 3 + 2] = -Math.random() * 2 - 1;
    }
    
    return { particlePositions: positions, particleVelocities: velocities };
  }, []);

  // Light streams
  const { streamGeometry } = useMemo(() => {
    const positions = new Float32Array(STREAM_COUNT * 2 * 3);
    const colors = new Float32Array(STREAM_COUNT * 2 * 3);
    
    for (let i = 0; i < STREAM_COUNT; i++) {
      const angle = (i / STREAM_COUNT) * Math.PI * 2 + Math.random();
      const radius = 60 + Math.random() * 80;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = (Math.random() - 0.5) * 80;
      
      // Start point
      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      
      // End point (behind)
      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y;
      positions[i * 6 + 5] = z + 30;
      
      // Color gradient (cyan to purple)
      const t = i / STREAM_COUNT;
      const r = 0.3 + t * 0.7;
      const g = 0.5;
      const b = 1.0;
      
      colors[i * 6] = r;
      colors[i * 6 + 1] = g;
      colors[i * 6 + 2] = b;
      colors[i * 6 + 3] = r * 0.3;
      colors[i * 6 + 4] = g * 0.3;
      colors[i * 6 + 5] = b * 0.3;
    }
    
    return { streamGeometry: { positions, colors } };
  }, []);

  useFrame((state, delta) => {
    if (!isActive || journeyProgress <= 0) return;

    const speed = journeyProgress * 2;
    const moveSpeed = speed * delta * 20;

    // Move visualizer forward through space
    if (visualizerRef?.current) {
      visualizerRef.current.position.z += moveSpeed;
      
      // Move camera and its target along with the visualizer
      state.camera.position.z += moveSpeed;
      
      // Update OrbitControls target to follow visualizer
      if (state.controls && state.controls.target) {
        state.controls.target.z += moveSpeed;
        state.controls.update();
      }
    }

    // Animate flying particles
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array;
      
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        positions[i * 3] += particleVelocities[i * 3] * speed * delta * 60;
        positions[i * 3 + 1] += particleVelocities[i * 3 + 1] * speed * delta * 60;
        positions[i * 3 + 2] += particleVelocities[i * 3 + 2] * speed * delta * 60;
        
        // Reset particle if it goes behind camera
        if (positions[i * 3 + 2] > state.camera.position.z + 20) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 50 + Math.random() * 100;
          positions[i * 3] = Math.cos(angle) * radius;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
          positions[i * 3 + 2] = state.camera.position.z - 150;
        }
      }
      
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Animate light streams
    if (lightStreamsRef.current) {
      const positions = lightStreamsRef.current.geometry.attributes.position.array;
      
      for (let i = 0; i < STREAM_COUNT; i++) {
        positions[i * 6 + 2] += speed * delta * 80;
        positions[i * 6 + 5] += speed * delta * 80;
        
        // Reset stream if it passes camera
        if (positions[i * 6 + 2] > state.camera.position.z + 50) {
          const angle = (i / STREAM_COUNT) * Math.PI * 2 + Math.random();
          const radius = 60 + Math.random() * 80;
          positions[i * 6] = Math.cos(angle) * radius;
          positions[i * 6 + 1] = (Math.random() - 0.5) * 80;
          positions[i * 6 + 2] = state.camera.position.z - 200;
          positions[i * 6 + 3] = positions[i * 6];
          positions[i * 6 + 4] = positions[i * 6 + 1];
          positions[i * 6 + 5] = positions[i * 6 + 2] + 30;
        }
      }
      
      lightStreamsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group visible={isActive && journeyProgress > 0}>
      {/* Flying particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={PARTICLE_COUNT}
            array={particlePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.6}
          color="#88ccff"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Light streams */}
      <lineSegments ref={lightStreamsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={STREAM_COUNT * 2}
            array={streamGeometry.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={STREAM_COUNT * 2}
            array={streamGeometry.colors}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.7}
          linewidth={2}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}
