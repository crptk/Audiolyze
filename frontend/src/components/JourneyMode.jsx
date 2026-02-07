'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function JourneyMode({ 
  isActive = false,
  journeyProgress = 0,
  hue = 0.78,
  saturation = 1.0,
  lightness = 0.6,
}) {
  const particlesRef = useRef();
  const lightStreamsRef = useRef();
  const particleMaterialRef = useRef();
  const streamMaterialRef = useRef();
  
  const PARTICLE_COUNT = 600;
  const STREAM_COUNT = 50;

  // Constant movement speed - particles always rush past at this rate
  const BASE_SPEED = 1.8;

  // Pre-position all particles in a tunnel ahead of the camera
  const { particlePositions, particleSpeeds } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const speeds = new Float32Array(PARTICLE_COUNT);
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Spread particles in a cylindrical tunnel around the Z axis
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * 60;
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      // Distribute along the Z axis from far away to just past camera
      positions[i * 3 + 2] = -200 + Math.random() * 260;
      
      // Each particle has a slightly different speed for parallax
      speeds[i] = 0.6 + Math.random() * 0.8;
    }
    
    return { particlePositions: positions, particleSpeeds: speeds };
  }, []);

  // Light streams - long streaks that rush past
  const { streamPositions, streamColors, streamSpeeds } = useMemo(() => {
    const positions = new Float32Array(STREAM_COUNT * 2 * 3);
    const colors = new Float32Array(STREAM_COUNT * 2 * 3);
    const speeds = new Float32Array(STREAM_COUNT);
    
    for (let i = 0; i < STREAM_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 15 + Math.random() * 50;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const z = -200 + Math.random() * 260;
      const streakLength = 15 + Math.random() * 25;
      
      // Start point (front)
      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      
      // End point (tail, further behind)
      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y;
      positions[i * 6 + 5] = z - streakLength;
      
      // Color: bright head, dim tail
      const hue = 0.55 + Math.random() * 0.15; // cyan to blue range
      const color = new THREE.Color().setHSL(hue, 0.8, 0.7);
      const tailColor = new THREE.Color().setHSL(hue, 0.6, 0.3);
      
      colors[i * 6] = color.r;
      colors[i * 6 + 1] = color.g;
      colors[i * 6 + 2] = color.b;
      colors[i * 6 + 3] = tailColor.r;
      colors[i * 6 + 4] = tailColor.g;
      colors[i * 6 + 5] = tailColor.b;
      
      speeds[i] = 0.8 + Math.random() * 0.6;
    }
    
    return { streamPositions: positions, streamColors: colors, streamSpeeds: speeds };
  }, []);

  useFrame((state, delta) => {
    if (!isActive && journeyProgress <= 0) return;

    // Fade in during first 15%, fade out during last 15%
    let opacity = 1;
    if (journeyProgress < 0.15) {
      opacity = journeyProgress / 0.15;
    } else if (journeyProgress > 0.85) {
      opacity = (1 - journeyProgress) / 0.15;
    }
    opacity = Math.max(0, Math.min(1, opacity));

    // Update material opacity for smooth fade + sync color with visualizer
    if (particleMaterialRef.current) {
      particleMaterialRef.current.opacity = opacity * 0.7;
      particleMaterialRef.current.color.setHSL(hue, saturation, lightness + 0.2);
    }
    if (streamMaterialRef.current) {
      streamMaterialRef.current.opacity = opacity * 0.6;
      // Update stream vertex colors to match visualizer hue
      if (lightStreamsRef.current) {
        const colors = lightStreamsRef.current.geometry.attributes.color.array;
        for (let i = 0; i < STREAM_COUNT; i++) {
          const hueVariation = hue + (Math.random() - 0.5) * 0.05;
          const headColor = new THREE.Color().setHSL(hueVariation, saturation * 0.8, lightness + 0.15);
          const tailColor = new THREE.Color().setHSL(hueVariation, saturation * 0.6, lightness * 0.5);
          colors[i * 6] = headColor.r;
          colors[i * 6 + 1] = headColor.g;
          colors[i * 6 + 2] = headColor.b;
          colors[i * 6 + 3] = tailColor.r;
          colors[i * 6 + 4] = tailColor.g;
          colors[i * 6 + 5] = tailColor.b;
        }
        lightStreamsRef.current.geometry.attributes.color.needsUpdate = true;
      }
    }

    // Particles always move at constant speed (no acceleration)
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array;
      
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Move toward camera at constant speed
        positions[i * 3 + 2] += BASE_SPEED * particleSpeeds[i] * delta * 60;
        
        // When particle passes camera, respawn far behind
        if (positions[i * 3 + 2] > 80) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 8 + Math.random() * 60;
          positions[i * 3] = Math.cos(angle) * radius;
          positions[i * 3 + 1] = Math.sin(angle) * radius;
          positions[i * 3 + 2] = -180 - Math.random() * 60;
        }
      }
      
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Light streams always move at constant speed
    if (lightStreamsRef.current) {
      const positions = lightStreamsRef.current.geometry.attributes.position.array;
      
      for (let i = 0; i < STREAM_COUNT; i++) {
        const moveAmount = BASE_SPEED * streamSpeeds[i] * delta * 60;
        
        // Move both endpoints forward
        positions[i * 6 + 2] += moveAmount;
        positions[i * 6 + 5] += moveAmount;
        
        // Respawn when head passes camera
        if (positions[i * 6 + 2] > 80) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 15 + Math.random() * 50;
          const streakLength = 15 + Math.random() * 25;
          const z = -180 - Math.random() * 60;
          
          positions[i * 6] = Math.cos(angle) * radius;
          positions[i * 6 + 1] = Math.sin(angle) * radius;
          positions[i * 6 + 2] = z;
          positions[i * 6 + 3] = positions[i * 6];
          positions[i * 6 + 4] = positions[i * 6 + 1];
          positions[i * 6 + 5] = z - streakLength;
        }
      }
      
      lightStreamsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group visible={isActive && journeyProgress > 0}>
      {/* Rushing particles */}
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
          ref={particleMaterialRef}
          size={0.4}
          color="#aaddff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Light streaks */}
      <lineSegments ref={lightStreamsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={STREAM_COUNT * 2}
            array={streamPositions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={STREAM_COUNT * 2}
            array={streamColors}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          ref={streamMaterialRef}
          vertexColors
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}
