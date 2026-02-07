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

// Shape generators
const SHAPES = {
  JELLYFISH: 'jellyfish',
  SPHERE: 'sphere',
  TORUS: 'torus',
  SPIRAL: 'spiral',
  CUBE: 'cube',
  WAVE: 'wave'
};

const generateShape = (shapeType, pointCount) => {
  const positions = new Float32Array(pointCount * 3);
  
  switch(shapeType) {
    case SHAPES.JELLYFISH: {
      const height = 18;
      const baseRadius = 6;
      let idx = 0;
      for (let p = 0; p < pointCount; p++) {
        const t = Math.random();
        const y = (0.5 - t) * height;
        const radius = baseRadius * (1 - t * 0.85);
        const angle = Math.random() * Math.PI * 2;
        const r = radius * Math.sqrt(Math.random());
        positions[idx++] = Math.cos(angle) * r;
        positions[idx++] = y;
        positions[idx++] = Math.sin(angle) * r;
      }
      break;
    }
    case SHAPES.SPHERE: {
      let idx = 0;
      const radius = 8;
      for (let p = 0; p < pointCount; p++) {
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = Math.random() * Math.PI * 2;
        const r = radius * Math.cbrt(Math.random());
        positions[idx++] = r * Math.sin(phi) * Math.cos(theta);
        positions[idx++] = r * Math.sin(phi) * Math.sin(theta);
        positions[idx++] = r * Math.cos(phi);
      }
      break;
    }
    case SHAPES.TORUS: {
      let idx = 0;
      const majorRadius = 6;
      const minorRadius = 2.5;
      for (let p = 0; p < pointCount; p++) {
        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * Math.PI * 2;
        positions[idx++] = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
        positions[idx++] = minorRadius * Math.sin(v);
        positions[idx++] = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);
      }
      break;
    }
    case SHAPES.SPIRAL: {
      let idx = 0;
      const maxRadius = 8;
      const height = 16;
      for (let p = 0; p < pointCount; p++) {
        const t = p / pointCount;
        const angle = t * Math.PI * 12;
        const r = maxRadius * t + Math.random() * 0.8;
        const y = (t - 0.5) * height;
        positions[idx++] = Math.cos(angle) * r;
        positions[idx++] = y;
        positions[idx++] = Math.sin(angle) * r;
      }
      break;
    }
    case SHAPES.CUBE: {
      let idx = 0;
      const size = 10;
      for (let p = 0; p < pointCount; p++) {
        const side = Math.floor(Math.random() * 6);
        const u = (Math.random() - 0.5) * size;
        const v = (Math.random() - 0.5) * size;
        if (side === 0) { positions[idx++] = size/2; positions[idx++] = u; positions[idx++] = v; }
        else if (side === 1) { positions[idx++] = -size/2; positions[idx++] = u; positions[idx++] = v; }
        else if (side === 2) { positions[idx++] = u; positions[idx++] = size/2; positions[idx++] = v; }
        else if (side === 3) { positions[idx++] = u; positions[idx++] = -size/2; positions[idx++] = v; }
        else if (side === 4) { positions[idx++] = u; positions[idx++] = v; positions[idx++] = size/2; }
        else { positions[idx++] = u; positions[idx++] = v; positions[idx++] = -size/2; }
      }
      break;
    }
    case SHAPES.WAVE: {
      let idx = 0;
      const width = 12;
      const depth = 12;
      const amplitude = 4;
      for (let p = 0; p < pointCount; p++) {
        const x = (Math.random() - 0.5) * width;
        const z = (Math.random() - 0.5) * depth;
        const y = Math.sin(x * 0.5) * Math.cos(z * 0.5) * amplitude;
        positions[idx++] = x;
        positions[idx++] = y;
        positions[idx++] = z;
      }
      break;
    }
  }
  
  return positions;
};

export default function IdleVisualizer({ 
  audioData = null,
  analyser = null,
  aiParams,
  isPlaying = false,
  onBeatUpdate = null,
  currentTime = 0
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
  
  const beatDetectionRef = useRef({
    bassHistory: [],
    lastBeatTime: 0,
  });

  const { camera } = useThree();

  // Generate initial geometry with shape morphing support
  const { positions, originalPositions, targetPositions, pointCount } = useMemo(() => {
    const POINT_COUNT = 14000;
    const positions = new Float32Array(POINT_COUNT * 3);
    const originalPositions = generateShape(SHAPES.JELLYFISH, POINT_COUNT);
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

  // Check for shape transitions based on timestamp
  useEffect(() => {
    if (!isPlaying) return;
    
    const currentTimestamp = Math.floor(currentTime);
    
    SHAPE_TIMESTAMPS.forEach(ts => {
      if (currentTimestamp === ts.time && lastTimestampRef.current !== ts.time) {
        lastTimestampRef.current = ts.time;
        
        // Select random shape different from current
        const availableShapes = Object.values(SHAPES).filter(s => s !== currentShapeRef.current);
        const newShape = availableShapes[Math.floor(Math.random() * availableShapes.length)];
        
        console.log('[v0] Shape transition:', currentShapeRef.current, '→', newShape);
        
        // Generate target shape
        const newPositions = generateShape(newShape, pointCount);
        targetPositions.set(newPositions);
        targetShapeRef.current = newShape;
        morphProgressRef.current = 0;
      }
    });
  }, [currentTime, isPlaying, pointCount, targetPositions]);

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
    
    // Get real-time audio data from Web Audio API
    if (analyser && isPlaying) {
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      // Separate frequency ranges
      const bassRange = dataArray.slice(0, Math.floor(bufferLength * 0.15));
      const midRange = dataArray.slice(Math.floor(bufferLength * 0.15), Math.floor(bufferLength * 0.5));
      const trebleRange = dataArray.slice(Math.floor(bufferLength * 0.5), bufferLength);

      // Calculate bass (for beats/expansion)
      let bass = (bassRange.reduce((a, b) => a + b, 0) / bassRange.length) / 255;
      bass = Math.pow(bass, 0.7) * 2.0;

      // Calculate vocals (mid+treble for particle behavior)
      let mid = (midRange.reduce((a, b) => a + b, 0) / midRange.length) / 255;
      let treble = (trebleRange.reduce((a, b) => a + b, 0) / trebleRange.length) / 255;
      mid = Math.pow(mid, 0.6) * 2.2;
      treble = Math.pow(treble, 0.6) * 1.8;
      
      const vocalEnergy = (mid * 1.5 + treble) / 2.5;

      // Beat detection for expansion
      const beatDetection = beatDetectionRef.current;
      beatDetection.bassHistory.push(bass);
      if (beatDetection.bassHistory.length > 20) {
        beatDetection.bassHistory.shift();
      }

      const avgBass = beatDetection.bassHistory.reduce((a, b) => a + b, 0) / beatDetection.bassHistory.length;
      const now = Date.now();
      
      // Detect beat - triggers expansion
      if (bass > avgBass * 1.5 && bass > 0.4 && now - beatDetection.lastBeatTime > 100) {
        audioState.beatHit = 6.0;
        audioState.expansion = 3.5;
        beatDetection.lastBeatTime = now;
      }

      // Update vocal-driven parameters (smooth transitions)
      audioState.vocalEnergy = THREE.MathUtils.lerp(audioState.vocalEnergy, vocalEnergy, 0.2);
      audioState.vocalIntensity = THREE.MathUtils.lerp(audioState.vocalIntensity, mid, 0.25);
      audioState.particleSpeed = THREE.MathUtils.lerp(audioState.particleSpeed, vocalEnergy, 0.15);
      audioState.turbulence = THREE.MathUtils.lerp(audioState.turbulence, vocalEnergy * 1.5, 0.2);

      // Update beat-driven parameters (fast attack, slow decay)
      audioState.bassStrength = THREE.MathUtils.lerp(audioState.bassStrength, bass, 0.35);
      audioState.beatHit *= 0.78;
      audioState.expansion *= 0.82;
    } else {
      // Idle state - default gentle flow
      audioState.vocalEnergy = THREE.MathUtils.lerp(audioState.vocalEnergy, 0.05, 0.08);
      audioState.vocalIntensity = THREE.MathUtils.lerp(audioState.vocalIntensity, 0, 0.1);
      audioState.particleSpeed = THREE.MathUtils.lerp(audioState.particleSpeed, 0.1, 0.08);
      audioState.turbulence = THREE.MathUtils.lerp(audioState.turbulence, 0.02, 0.1);
      
      audioState.bassStrength = THREE.MathUtils.lerp(audioState.bassStrength, 0, 0.15);
      audioState.beatHit = THREE.MathUtils.lerp(audioState.beatHit, 0, 0.15);
      audioState.expansion = THREE.MathUtils.lerp(audioState.expansion, 0, 0.15);
    }

    // Update time based on VOCALS (particle speed and direction)
    const baseSpeed = isPlaying ? 0.3 : 0.08;
    const vocalSpeedMultiplier = 1 + audioState.particleSpeed * 4;
    timeRef.current += delta * baseSpeed * vocalSpeedMultiplier;

    // Handle shape morphing
    if (targetShapeRef.current && morphProgressRef.current < 1) {
      morphProgressRef.current += delta * 0.5; // Morph over 2 seconds
      
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
    const height = 18;
    const isMorphing = targetShapeRef.current !== null;
    const morphProgress = morphProgressRef.current;

    for (let i = 0; i < positions.length; i += 3) {
      // Lerp between original and target during morph
      let ox, oy, oz;
      if (isMorphing) {
        const easeProgress = morphProgress * morphProgress * (3 - 2 * morphProgress); // Smoothstep
        ox = THREE.MathUtils.lerp(originalPositions[i], targetPositions[i], easeProgress);
        oy = THREE.MathUtils.lerp(originalPositions[i + 1], targetPositions[i + 1], easeProgress);
        oz = THREE.MathUtils.lerp(originalPositions[i + 2], targetPositions[i + 2], easeProgress);
      } else {
        ox = originalPositions[i];
        oy = originalPositions[i + 1];
        oz = originalPositions[i + 2];
      }

      const r = Math.sqrt(ox * ox + oz * oz);
      const ny = (oy + height * 0.5) / height; // Normalized height 0→1

      // VOCAL-DRIVEN: Particle direction and turbulence
      const vocalTurbulence = audioState.turbulence * params.energy.turbulence;
      const directionNoise = 
        noise3D(ox * 0.15, oy * 0.15, timeRef.current * 0.5) * 
        (0.3 + vocalTurbulence * 2.5);
      
      const flowNoise = 
        noise3D(ox * 0.3, oy * 0.3, timeRef.current * 1.0) *
        audioState.vocalIntensity * 3;

      // BEAT-DRIVEN: Expansion and pulsing
      const expansionForce = audioState.beatHit * 30;
      const pulseExpansion = audioState.expansion * 8;

      // Base gentle flow (idle)
      const baseFlow = noise3D(ox * 0.05, oy * 0.05, timeRef.current * 0.1) * 2;

      // Tentacle effect driven by bass (beat-driven)
      const tentacle = Math.pow(ny, 2.5) * audioState.bassStrength * (3 + audioState.beatHit * 20);

      // Body expansion from beats
      const bodyExpansion = 1 + audioState.expansion * 0.25 + audioState.beatHit * 0.3;

      // Apply displacement
      // X/Z: Radial expansion from BEATS + directional flow from VOCALS
      const radialExpansion = (ox / (r + 0.001)) * (expansionForce + pulseExpansion);
      const vocalFlow = (ox / (r + 0.001)) * (directionNoise + flowNoise);
      positions[i] = ox * bodyExpansion + radialExpansion + vocalFlow;
      
      // Y: Vertical flow from vocals + tentacle from bass
      positions[i + 1] = oy + baseFlow * 0.3 + directionNoise * 0.5 + tentacle;
      
      positions[i + 2] = oz * bodyExpansion + radialExpansion + vocalFlow;
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

    // Send beat data to parent for star field
    if (onBeatUpdate) {
      onBeatUpdate({
        beatHit: audioState.beatHit,
        expansion: audioState.expansion
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
