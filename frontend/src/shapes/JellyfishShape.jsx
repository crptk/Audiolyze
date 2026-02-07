import { useMemo } from 'react';
import { noise3D } from '../utils/noise';

export function generateJellyfishPositions(pointCount) {
  const positions = new Float32Array(pointCount * 3);
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
  
  return positions;
}

export function applyJellyfishMotion(positions, originalPositions, audioState, timeRef, params) {
  const height = 18;
  
  for (let i = 0; i < positions.length; i += 3) {
    const ox = originalPositions[i];
    const oy = originalPositions[i + 1];
    const oz = originalPositions[i + 2];
    
    const r = Math.sqrt(ox * ox + oz * oz);
    const ny = (oy + height * 0.5) / height;
    
    // VOCAL-DRIVEN: Swimming motion
    const vocalTurbulence = audioState.turbulence * params.energy.turbulence;
    const swimX = noise3D(ox * 0.15, oy * 0.15, timeRef.current * 0.5) * (0.3 + vocalTurbulence * 2.5);
    const swimY = noise3D(ox * 0.2, oy * 0.2, timeRef.current * 0.6) * (0.4 + vocalTurbulence * 2.0);
    const swimZ = noise3D(oz * 0.15, oy * 0.15, timeRef.current * 0.5) * (0.3 + vocalTurbulence * 2.5);
    
    const flowNoise = noise3D(ox * 0.3, oy * 0.3, timeRef.current * 1.0) * audioState.vocalIntensity * 3;
    
    // BEAT-DRIVEN: Expansion
    const expansionForce = audioState.beatHit * 30;
    const pulseExpansion = audioState.expansion * 8;
    
    // Base gentle flow
    const baseFlow = noise3D(ox * 0.05, oy * 0.05, timeRef.current * 0.1) * 2;
    
    // Tentacle effect
    const tentacle = Math.pow(ny, 2.5) * audioState.bassStrength * (3 + audioState.beatHit * 20);
    
    // Body expansion from beats
    const bodyExpansion = 1 + audioState.expansion * 0.25 + audioState.beatHit * 0.3;
    
    // Apply displacement
    const radialExpansion = (ox / (r + 0.001)) * (expansionForce + pulseExpansion);
    const vocalFlow = (ox / (r + 0.001)) * (swimX + flowNoise);
    
    positions[i] = ox * bodyExpansion + radialExpansion + vocalFlow;
    positions[i + 1] = oy + baseFlow * 0.3 + swimY * 0.5 + tentacle;
    positions[i + 2] = oz * bodyExpansion + radialExpansion + (swimZ + flowNoise) * (oz / (r + 0.001));
  }
}
