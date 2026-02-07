'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Placeholder AI parameters - will be replaced with actual AI analysis
const DEFAULT_AI_PARAMS = {
  colorScheme: {
    warmth: 0.5, // 0 = cool/sad, 1 = warm/happy
    hueBase: 0.78, // Base hue (pink-ish)
    saturation: 1.0,
    brightness: 0.6,
  },
  energy: {
    baseFlow: 0.8, // Base animation speed
    turbulence: 1.0, // Noise intensity
    particleSize: 0.18,
  },
  camera: {
    baseFOV: 60,
    fovRange: 16, // How much FOV varies
  },
  // Placeholder: Will be filled by AI with timestamps for warm/cool/intense sections
  timeline: [],
};

// 3D Noise function for organic movement
function noise3D(x, y, z) {
  return (
    (Math.sin(x * 1.7 + z) + Math.sin(y * 1.3 + x) + Math.sin(z * 1.5 + y)) / 3
  );
}

export default function IdleVisualizer({ 
  audioData = null, 
  aiParams,
  isPlaying = false 
}) {
  console.log('[v0] IdleVisualizer rendering', { aiParams });
  
  // Ensure aiParams is always valid
  const params = aiParams || DEFAULT_AI_PARAMS;
  
  const pointsRef = useRef();
  const materialRef = useRef();
  const timeRef = useRef(0);
  const audioStateRef = useRef({
    flowEnergy: 0,
    bassStrength: 0,
    trebleStrength: 0,
    beatHit: 0,
    speedBoost: 1,
  });

  const { camera } = useThree();

  // Generate jellyfish geometry
  const { positions, originalPositions, pointCount } = useMemo(() => {
    const POINT_COUNT = 14000;
    const positions = new Float32Array(POINT_COUNT * 3);
    const originalPositions = new Float32Array(POINT_COUNT * 3);
    
    const height = 18;
    const baseRadius = 6;

    let idx = 0;
    for (let p = 0; p < POINT_COUNT; p++) {
      const t = Math.random();
      const y = (0.5 - t) * height;
      const radius = baseRadius * (1 - t * 0.85);
      const angle = Math.random() * Math.PI * 2;
      const r = radius * Math.sqrt(Math.random());

      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      originalPositions[idx] = x;
      originalPositions[idx + 1] = y;
      originalPositions[idx + 2] = z;

      idx += 3;
    }

    return { positions, originalPositions, pointCount: POINT_COUNT };
  }, []);

  // Process audio data if available
  useEffect(() => {
    if (!audioData || !isPlaying) return;

    // TODO: Connect to Web Audio API analyzer
    // This will be filled when audio is loaded
    console.log('[v0] Audio data ready for processing');
  }, [audioData, isPlaying]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const audioState = audioStateRef.current;
    
    // Simulate audio reactivity (replace with actual audio analysis)
    if (audioData && isPlaying) {
      // TODO: Get real-time frequency data from Web Audio API
      // For now, using placeholder values
      const bass = 0.3;
      const treble = 0.2;
      const energy = 0.4;

      audioState.flowEnergy = THREE.MathUtils.lerp(audioState.flowEnergy, energy, 0.05);
      audioState.bassStrength = THREE.MathUtils.lerp(audioState.bassStrength, bass, 0.1);
      audioState.trebleStrength = THREE.MathUtils.lerp(audioState.trebleStrength, treble, 0.1);

      if (bass > 0.65) {
        audioState.beatHit = 1;
        audioState.speedBoost = 2.8;
      }

      audioState.beatHit *= 0.9;
      audioState.speedBoost = THREE.MathUtils.lerp(audioState.speedBoost, 1, 0.08);
    } else {
      // Idle state - gentle flowing motion
      audioState.flowEnergy = 0.3;
      audioState.bassStrength = 0;
      audioState.trebleStrength = 0;
      audioState.beatHit = 0;
      audioState.speedBoost = 1;
    }

    // Update time based on energy and AI parameters
    const timeScale = params.energy.baseFlow * (0.8 + audioState.flowEnergy * 2.2);
    timeRef.current += delta * audioState.speedBoost * timeScale;

    // Update particle positions with jellyfish-like flow
    const positionAttribute = pointsRef.current.geometry.attributes.position;
    const positions = positionAttribute.array;
    const height = 18;

    for (let i = 0; i < positions.length; i += 3) {
      const ox = originalPositions[i];
      const oy = originalPositions[i + 1];
      const oz = originalPositions[i + 2];

      const r = Math.sqrt(ox * ox + oz * oz);
      const ny = (oy + height * 0.5) / height; // Normalized height 0→1

      // Fractal noise layers for organic movement
      const low = noise3D(ox * 0.05, oy * 0.05, timeRef.current * 0.15) * 3.5;
      const mid =
        noise3D(ox * 0.15, oy * 0.15, timeRef.current * 0.4) *
        (2 + audioState.flowEnergy * 4) *
        params.energy.turbulence;
      const high =
        noise3D(ox * 0.4, oy * 0.4, timeRef.current * 1.2) *
        (audioState.beatHit * 6);

      // Tentacle effect (stronger at bottom, driven by bass)
      const tentacle =
        Math.pow(ny, 2.2) * audioState.bassStrength * (2 + audioState.beatHit * 6);

      // Body shape morphing
      const body = 1 + low * 0.08 + mid * 0.05;

      // Apply displacement
      positions[i] = ox * body + (ox / (r + 0.001)) * (mid + high);
      positions[i + 1] = oy + low * 0.4 + tentacle;
      positions[i + 2] = oz * body + (oz / (r + 0.001)) * (mid + high);
    }

    positionAttribute.needsUpdate = true;

    // Update camera FOV based on energy (AI-driven in future)
    if (camera.isPerspectiveCamera) {
      camera.fov =
        params.camera.baseFOV +
        audioState.flowEnergy * params.camera.fovRange +
        audioState.beatHit * 14;
      camera.updateProjectionMatrix();
    }

    // Update color based on energy and AI warmth parameter
    if (materialRef.current) {
      const hue = params.colorScheme.hueBase - audioState.flowEnergy * 0.4;
      const lightness = params.colorScheme.brightness + audioState.beatHit * 0.1;
      
      materialRef.current.color
        .setHSL(hue, params.colorScheme.saturation, lightness)
        .multiplyScalar(1.6 + audioState.flowEnergy + audioState.beatHit);
    }

    // Gentle rotation
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.05 * (isPlaying ? 1.5 : 0.5);
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={pointCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={params.energy.particleSize}
        color="#ff77cc"
        transparent
        opacity={0.9}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
