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
import { generateWavePositions, applyWaveMotion} from '../shapes/WaveShape';

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
  currentTime = 0,
  manualShape = null
}) {
  // Ensure aiParams is always valid
  const params = aiParams || DEFAULT_AI_PARAMS;
  
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
      console.log('[v0] Loaded', params.beats.length, 'beat timestamps:', params.beats.slice(0, 5));
    }
  }, [params.beats]);

  
  // Initialize Butterchurn audio analyzer
  useEffect(() => {
    if (analyser && !audioAnalyzerRef.current) {
      audioAnalyzerRef.current = new ButterchurnAudioAnalyzer(analyser);
      console.log('[v0] Butterchurn audio analyzer initialized');
    }
  }, [analyser]);

  // Generate initial geometry with shape morphing support
  const { positions, originalPositions, targetPositions, pointCount } = useMemo(() => {
    const POINT_COUNT = 14000;
    const positions = new Float32Array(POINT_COUNT * 3);
    const originalPositions = SHAPE_GENERATORS[SHAPES.JELLYFISH](POINT_COUNT);
    const targetPositions = new Float32Array(POINT_COUNT * 3);
    
    positions.set(originalPositions);
    targetPositions.set(originalPositions);

    return { positions, originalPositions, targetPositions, pointCount: POINT_COUNT };
  }, []);

  // Hardcoded timestamps for shape changes (will be dynamic later)
  const SHAPE_TIMESTAMPS = [
    { time: 30, shape: null }, // Random shape
    { time: 60, shape: null },
    { time: 90, shape: null },
    { time: 120, shape: null }
  ];

  // Handle manual shape change - force immediate transition
  useEffect(() => {
    if (manualShape && manualShape !== currentShapeRef.current) {
      console.log('[v0] Manual shape change:', currentShapeRef.current, '→', manualShape);
      
      // Generate target shape using appropriate generator
      const newPositions = SHAPE_GENERATORS[manualShape](pointCount);
      targetPositions.set(newPositions);
      targetShapeRef.current = manualShape;
      morphProgressRef.current = 0;
    }
  }, [manualShape, pointCount, targetPositions]);

  // Check for shape transitions based on timestamp
  useEffect(() => {
    if (!isPlaying || manualShape) return; // Skip auto transitions if manual shape is set
    
    const currentTimestamp = Math.floor(currentTime);
    
    SHAPE_TIMESTAMPS.forEach(ts => {
      if (currentTimestamp === ts.time && lastTimestampRef.current !== ts.time) {
        lastTimestampRef.current = ts.time;
        
        // Select random shape different from current
        const availableShapes = Object.values(SHAPES).filter(s => s !== currentShapeRef.current);
        const newShape = availableShapes[Math.floor(Math.random() * availableShapes.length)];
        
        console.log('[v0] Shape transition:', currentShapeRef.current, '→', newShape);
        
        // Generate target shape using appropriate generator
        const newPositions = SHAPE_GENERATORS[newShape](pointCount);
        targetPositions.set(newPositions);
        targetShapeRef.current = newShape;
        morphProgressRef.current = 0;
      }
    });
  }, [currentTime, isPlaying, manualShape, pointCount, targetPositions]);

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
    
    // Get real-time audio data using Butterchurn-style analyzer
    if (audioAnalyzerRef.current && isPlaying) {
      const audioData = audioAnalyzerRef.current.analyze();
      
      // Use smoothed values with attack/decay for better visual response
      const bass = audioData.bass_att;
      const mid = audioData.mid_att;
      const treb = audioData.treb_att;
      const vol = audioData.vol_att;
      
      // Calculate vocal energy from mid and treble
      const vocalEnergy = (mid * 1.5 + treb) / 2.5;

      // Check for beat timestamps from backend (librosa)
      if (beatTimestampsRef.current.length > 0) {
        const currentBeat = beatTimestampsRef.current[lastBeatIndexRef.current];
        
        if (currentBeat && Math.abs(currentTime - currentBeat.time) < 0.05) {
          // Trigger beat at timestamp with strength from librosa
          const strength = currentBeat.strength || 1.0;
          audioState.beatHit = 4.0 + strength * 4.0;
          audioState.expansion = 2.5 + strength * 2.5;
          console.log('[v0] Beat timestamp hit!', currentBeat.time.toFixed(2), 's, strength:', strength.toFixed(2));
          lastBeatIndexRef.current++;
        }
      }

      // Update vocal-driven parameters (smooth transitions)
      audioState.vocalEnergy = THREE.MathUtils.lerp(audioState.vocalEnergy, vocalEnergy, 0.2);
      audioState.vocalIntensity = THREE.MathUtils.lerp(audioState.vocalIntensity, mid, 0.25);
      audioState.particleSpeed = THREE.MathUtils.lerp(audioState.particleSpeed, vocalEnergy, 0.15);
      audioState.turbulence = THREE.MathUtils.lerp(audioState.turbulence, vocalEnergy * 1.5, 0.2);

      // Update beat-driven parameters (fast decay for next beat)
      audioState.bassStrength = THREE.MathUtils.lerp(audioState.bassStrength, bass, 0.35);
      audioState.beatHit = THREE.MathUtils.lerp(audioState.beatHit, 0, 0.12);
      audioState.expansion = THREE.MathUtils.lerp(audioState.expansion, 0, 0.10);
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

    // Handle shape morphing - faster and smoother
    if (targetShapeRef.current && morphProgressRef.current < 1) {
      morphProgressRef.current += delta * 0.8; // Morph over ~1.25 seconds
      
      if (morphProgressRef.current >= 1) {
        morphProgressRef.current = 1;
        originalPositions.set(targetPositions);
        currentShapeRef.current = targetShapeRef.current;
        targetShapeRef.current = null;
        console.log('[v0] Morph complete:', currentShapeRef.current);
      }
    }

    // Update particle positions
    const positionAttribute = pointsRef.current.geometry.attributes.position;
    const positions = positionAttribute.array;
    const isMorphing = targetShapeRef.current !== null;
    const morphProgress = morphProgressRef.current;

    // Create morphed positions array if needed
    const morphedPositions = isMorphing ? new Float32Array(originalPositions.length) : originalPositions;
    
    if (isMorphing) {
      const easeProgress = morphProgress * morphProgress * (3 - 2 * morphProgress); // Smoothstep
      for (let i = 0; i < morphedPositions.length; i++) {
        morphedPositions[i] = THREE.MathUtils.lerp(originalPositions[i], targetPositions[i], easeProgress);
      }
    }

    // Apply shape-specific motion
    const currentMotion = SHAPE_MOTIONS[currentShapeRef.current];
    currentMotion(positions, morphedPositions, audioState, timeRef, params);

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
      
      const intensity =
        1.4 +
        audioState.vocalEnergy * 1.2 +
        audioState.beatHit * 2.2;

    materialRef.current.color
      .setHSL(hue, params.colorScheme.saturation, lightness)
      .multiplyScalar(THREE.MathUtils.clamp(intensity, 1.0, 3.2));
    }

    // Rotation: Driven by vocal energy (particle movement)
    if (pointsRef.current) {
      const rotationSpeed = isPlaying ? (0.08 + audioState.particleSpeed * 0.4) : 0.015;
      pointsRef.current.rotation.y += delta * rotationSpeed;
    }

    // Send beat data to parent for star field and aurora ring
    if (onBeatUpdate) {
      onBeatUpdate({
        beatHit: audioState.beatHit,
        expansion: audioState.expansion,
        bassStrength: audioState.bassStrength
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
