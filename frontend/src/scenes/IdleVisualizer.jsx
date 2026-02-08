'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ButterchurnAudioAnalyzer } from '../utils/butterchurnAudioAnalyzer';
import { generateJellyfishPositions, applyJellyfishMotion } from '../shapes/JellyfishShape';
import { generateSpherePositions, applySphereMotion } from '../shapes/SphereShape';
import { generateTorusPositions, applyTorusMotion } from '../shapes/TorusShape';
import { generateSpiralPositions, applySpiralMotion } from '../shapes/SpiralShape';
import { generateCubePositions, applyCubeMotion } from '../shapes/CubeShape';
import { generateWavePositions, applyWaveMotion } from '../shapes/WaveShape';

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

// Shape types
const SHAPES = {
  JELLYFISH: 'jellyfish',
  SPHERE: 'sphere',
  TORUS: 'torus',
  SPIRAL: 'spiral',
  CUBE: 'cube',
  WAVE: 'wave'
};

// Shape generator registry
const SHAPE_GENERATORS = {
  [SHAPES.JELLYFISH]: generateJellyfishPositions,
  [SHAPES.SPHERE]: generateSpherePositions,
  [SHAPES.TORUS]: generateTorusPositions,
  [SHAPES.SPIRAL]: generateSpiralPositions,
  [SHAPES.CUBE]: generateCubePositions,
  [SHAPES.WAVE]: generateWavePositions,
};

// Shape motion applicators
const SHAPE_MOTIONS = {
  [SHAPES.JELLYFISH]: applyJellyfishMotion,
  [SHAPES.SPHERE]: applySphereMotion,
  [SHAPES.TORUS]: applyTorusMotion,
  [SHAPES.SPIRAL]: applySpiralMotion,
  [SHAPES.CUBE]: applyCubeMotion,
  [SHAPES.WAVE]: applyWaveMotion,
};

export default function IdleVisualizer({
  audioData = null,
  analyser = null,
  aiParams,
  isPlaying = false,
  onBeatUpdate = null,
  onShapeChange = null,
  currentTime = 0,
  manualShape = null,
  audioTuning = null,
}) {
  // Ensure aiParams is always valid
  const params = aiParams || DEFAULT_AI_PARAMS;
  const tuning = audioTuning || { bass: 1.0, mid: 1.0, treble: 1.0, sensitivity: 1.0 };

  const pointsRef = useRef();
  const materialRef = useRef();
  const timeRef = useRef(0);
  const currentShapeRef = useRef(SHAPES.JELLYFISH);
  const targetShapeRef = useRef(null);
  const morphProgressRef = useRef(0);
  const lastTimestampRef = useRef(0);

  const audioStateRef = useRef({
    // Vocal-driven (mid/treble frequencies)
    vocalEnergy: 0,
    vocalIntensity: 0,
    particleSpeed: 0,
    turbulence: 0,

    // Beat-driven (bass frequencies)
    bassStrength: 0,
    beatHit: 0,
    expansion: 0,
  });

  const audioAnalyzerRef = useRef(null);
  const beatTimestampsRef = useRef([]);
  const lastBeatIndexRef = useRef(0);

  const { camera } = useThree();

  // Load beat timestamps from AI params
  useEffect(() => {
    if (params.beats && params.beats.length > 0) {
      beatTimestampsRef.current = params.beats;
      lastBeatIndexRef.current = 0;
    }
  }, [params.beats]);

  // Initialize Butterchurn audio analyzer (recreate when analyser changes)
  useEffect(() => {
    if (analyser) {
      audioAnalyzerRef.current = new ButterchurnAudioAnalyzer(analyser);
    } else {
      // Full cleanup when analyser is removed (back button)
      audioAnalyzerRef.current = null;
      beatTimestampsRef.current = [];
      lastBeatIndexRef.current = 0;
      lastTimestampRef.current = 0;
      // Reset audio state
      const s = audioStateRef.current;
      s.vocalEnergy = 0; s.vocalIntensity = 0; s.particleSpeed = 0;
      s.turbulence = 0; s.bassStrength = 0; s.beatHit = 0; s.expansion = 0;
    }
  }, [analyser]);

  // Generate initial geometry with shape morphing support
  const { positions, originalPositions, targetPositions, pointCount } = useMemo(() => {
    // Reduced from 14000 to 10000 to prevent WebGL context loss
    const POINT_COUNT = 10000;
    const positions = new Float32Array(POINT_COUNT * 3);
    const originalPositions = SHAPE_GENERATORS[SHAPES.JELLYFISH](POINT_COUNT);
    const targetPositions = new Float32Array(POINT_COUNT * 3);

    positions.set(originalPositions);
    targetPositions.set(originalPositions);

    return { positions, originalPositions, targetPositions, pointCount: POINT_COUNT };
  }, []);

  // Shape change timestamps from backend structural analysis
  const backendShapeChanges = params.shapeChanges || [];
  const SHAPE_TIMESTAMPS = backendShapeChanges.length > 0
    ? backendShapeChanges.map(t => ({ time: t, shape: null }))
    : [
        { time: 30, shape: null },
        { time: 60, shape: null },
        { time: 90, shape: null },
        { time: 120, shape: null },
      ];

  // Handle manual shape change - force immediate transition
  useEffect(() => {
    if (manualShape && manualShape !== currentShapeRef.current) {
      const newPositions = SHAPE_GENERATORS[manualShape](pointCount);
      targetPositions.set(newPositions);
      targetShapeRef.current = manualShape;
      morphProgressRef.current = 0;
      // Don't call onShapeChange for manual changes - it's already set in App.jsx
    }
  }, [manualShape, pointCount, targetPositions]);

  // Check for shape transitions based on timestamp (range-based for reliability)
  useEffect(() => {
    if (!isPlaying) return;

    for (const ts of SHAPE_TIMESTAMPS) {
      if (currentTime >= ts.time && currentTime < ts.time + 0.5 && lastTimestampRef.current !== ts.time) {
        lastTimestampRef.current = ts.time;

        const availableShapes = Object.values(SHAPES).filter(s => s !== currentShapeRef.current);
        const newShape = availableShapes[Math.floor(Math.random() * availableShapes.length)];

        const newPositions = SHAPE_GENERATORS[newShape](pointCount);
        targetPositions.set(newPositions);
        targetShapeRef.current = newShape;
        morphProgressRef.current = 0;
        if (onShapeChange) onShapeChange(newShape);
        break;
      }
    }
  }, [currentTime, isPlaying, pointCount, targetPositions, onShapeChange]);

  // Process audio data if available
  useEffect(() => {
    if (!audioData || !isPlaying) return;

    // TODO: Connect to Web Audio API analyzer
    // This will be filled when audio is loaded
    // Audio data connected
  }, [audioData, isPlaying]);

  // Proper cleanup of Three.js resources on unmount
  useEffect(() => {
    return () => {
      if (pointsRef.current) {
        // Dispose geometry
        if (pointsRef.current.geometry) {
          pointsRef.current.geometry.dispose();
        }
        // Dispose material
        if (pointsRef.current.material) {
          pointsRef.current.material.dispose();
        }
      }
    };
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const audioState = audioStateRef.current;

    // Get real-time audio data using Butterchurn-style analyzer
    if (audioAnalyzerRef.current && isPlaying) {
      const audioData = audioAnalyzerRef.current.analyze();

      // Apply tuning multipliers to audio bands
      const sens = tuning.sensitivity;
      const bass = audioData.bass_att * tuning.bass * sens;
      const mid = audioData.mid_att * tuning.mid * sens;
      const treb = audioData.treb_att * tuning.treble * sens;
      const vol = audioData.vol_att * sens;

      // Calculate vocal energy from mid and treble
      const vocalEnergy = (mid * 1.5 + treb) / 2.5;

      // Check for beat timestamps from backend (librosa)
      if (beatTimestampsRef.current.length > 0) {
        const currentBeat = beatTimestampsRef.current[lastBeatIndexRef.current];

        if (currentBeat && Math.abs(currentTime - currentBeat.time) < 0.05) {
          // Trigger beat at timestamp with strength from librosa
          const strength = currentBeat.strength || 1.0;
          audioState.beatHit = (4.0 + strength * 4.0) * tuning.bass;
          audioState.expansion = (2.5 + strength * 2.5) * tuning.bass;
          lastBeatIndexRef.current++;
        }
      }

      // Update vocal-driven parameters (smooth transitions)
      audioState.vocalEnergy = THREE.MathUtils.lerp(audioState.vocalEnergy, vocalEnergy, 0.25);
      audioState.vocalIntensity = THREE.MathUtils.lerp(audioState.vocalIntensity, mid, 0.3);
      audioState.particleSpeed = THREE.MathUtils.lerp(audioState.particleSpeed, vocalEnergy, 0.2);
      audioState.turbulence = THREE.MathUtils.lerp(audioState.turbulence, vocalEnergy * 1.5, 0.25);

      // Update beat-driven parameters - FAST decay so beats are sharp and distinct
      audioState.bassStrength = THREE.MathUtils.lerp(audioState.bassStrength, bass, 0.4);
      audioState.beatHit *= 0.82; // Fast exponential decay (~180ms to halve)
      audioState.expansion *= 0.85; // Fast exponential decay (~200ms to halve)
    } else {
      // Idle state - default gentle flow
      audioState.vocalEnergy = THREE.MathUtils.lerp(audioState.vocalEnergy, 0.05, 0.08);
      audioState.vocalIntensity = THREE.MathUtils.lerp(audioState.vocalIntensity, 0, 0.1);
      audioState.particleSpeed = THREE.MathUtils.lerp(audioState.particleSpeed, 0.1, 0.08);
      audioState.turbulence = THREE.MathUtils.lerp(audioState.turbulence, 0.02, 0.1);

      // Beat values should not decay when paused - just reset to 0
      audioState.bassStrength = 0;
      audioState.beatHit = 0;
      audioState.expansion = 0;
    }

    // Update time based on VOCALS (particle speed and direction)
    const baseSpeed = isPlaying ? 0.3 : 0.08;
    const vocalSpeedMultiplier = 1 + audioState.particleSpeed * 4;
    timeRef.current += delta * baseSpeed * vocalSpeedMultiplier;

    // Handle shape morphing - slow and fluid (~3 seconds)
    if (targetShapeRef.current && morphProgressRef.current < 1) {
      morphProgressRef.current += delta * 0.35;

      if (morphProgressRef.current >= 1) {
        morphProgressRef.current = 1;
        originalPositions.set(targetPositions);
        currentShapeRef.current = targetShapeRef.current;
        targetShapeRef.current = null;
      }
    }

    // Update particle positions
    const positionAttribute = pointsRef.current.geometry.attributes.position;
    const posArr = positionAttribute.array;
    const isMorphing = targetShapeRef.current !== null;
    const morphProgress = morphProgressRef.current;

    if (isMorphing) {
      // Smoothstep easing for position interpolation
      const t = morphProgress * morphProgress * (3 - 2 * morphProgress);

      // Apply OLD shape motion to original positions
      const oldMotionPos = new Float32Array(originalPositions.length);
      oldMotionPos.set(originalPositions);
      const currentMotion = SHAPE_MOTIONS[currentShapeRef.current];
      currentMotion(oldMotionPos, originalPositions, audioState, timeRef, params);

      // Apply NEW shape motion to target positions
      const newMotionPos = new Float32Array(targetPositions.length);
      newMotionPos.set(targetPositions);
      const targetMotion = SHAPE_MOTIONS[targetShapeRef.current];
      targetMotion(newMotionPos, targetPositions, audioState, timeRef, params);

      // Blend between old and new motion results
      for (let i = 0; i < posArr.length; i++) {
        posArr[i] = THREE.MathUtils.lerp(oldMotionPos[i], newMotionPos[i], t);
      }
    } else {
      // No morph -- apply current shape motion directly
      const currentMotion = SHAPE_MOTIONS[currentShapeRef.current];
      currentMotion(posArr, originalPositions, audioState, timeRef, params);
    }

    positionAttribute.needsUpdate = true;

    // Camera FOV: BEATS cause zoom/expansion effect
    if (camera.isPerspectiveCamera) {
      camera.fov =
        params.camera.baseFOV +
        audioState.vocalEnergy * params.camera.fovRange +
        audioState.beatHit * 60 +
        audioState.expansion * 15;
      camera.updateProjectionMatrix();
    }

    // Color: Vocals affect hue, beats affect brightness
    if (materialRef.current) {
      const hue = params.colorScheme.hueBase - audioState.vocalEnergy * 0.4;
      const lightness = params.colorScheme.brightness + audioState.beatHit * 0.3;

      materialRef.current.color
        .setHSL(hue, params.colorScheme.saturation, lightness)
        .multiplyScalar(1.8 + audioState.vocalEnergy * 1.5 + audioState.beatHit * 5.0);
    }

    // Rotation: Driven by vocal energy (particle movement)
    if (pointsRef.current) {
      const rotationSpeed = isPlaying ? (0.08 + audioState.particleSpeed * 0.4) : 0.015;
      pointsRef.current.rotation.y += delta * rotationSpeed;
    }

    // Send beat data + current color to parent for star field, aurora ring, journey
    if (onBeatUpdate) {
      const hue = params.colorScheme.hueBase - audioState.vocalEnergy * 0.4;
      const sat = params.colorScheme.saturation;
      const light = params.colorScheme.brightness + audioState.beatHit * 0.3;
      onBeatUpdate({
        beatHit: audioState.beatHit,
        expansion: audioState.expansion,
        bassStrength: audioState.bassStrength,
        hue,
        saturation: sat,
        lightness: light,
      });
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
