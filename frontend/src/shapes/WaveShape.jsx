import { noise3D } from '../utils/noise';

export function generateWavePositions(pointCount) {
  const positions = new Float32Array(pointCount * 3);
  const width = 12;
  const depth = 12;
  const amplitude = 4;
  
  let idx = 0;
  for (let p = 0; p < pointCount; p++) {
    const x = (Math.random() - 0.5) * width;
    const z = (Math.random() - 0.5) * depth;
    const y = Math.sin(x * 0.5) * Math.cos(z * 0.5) * amplitude;
    
    positions[idx++] = x;
    positions[idx++] = y;
    positions[idx++] = z;
  }
  
  return positions;
}

export function applyWaveMotion(positions, originalPositions, audioState, timeRef, params) {
  for (let i = 0; i < positions.length; i += 3) {
    const ox = originalPositions[i];
    const oy = originalPositions[i + 1];
    const oz = originalPositions[i + 2];
    
    // VOCAL-DRIVEN: Undulating/flowing motion
    const vocalTurbulence = audioState.turbulence * params.energy.turbulence;
    const waveX = noise3D(ox * 0.2, oz * 0.2, timeRef.current * 0.75) * (0.7 + vocalTurbulence * 4);
    const waveY = noise3D(ox * 0.25, oz * 0.25, timeRef.current * 0.85) * (1.0 + vocalTurbulence * 5);
    const waveZ = noise3D(oz * 0.2, ox * 0.2, timeRef.current * 0.75) * (0.7 + vocalTurbulence * 4);
    
    const oceanFlow = noise3D(ox * 0.15, oz * 0.15, timeRef.current * 0.6) * audioState.vocalIntensity * 6;
    
    // BEAT-DRIVEN: Vertical amplitude increase
    const beatLift = audioState.beatHit * 15;
    const amplify = 1 + audioState.expansion * 0.4 + audioState.beatHit * 0.5;
    
    // Apply displacement
    positions[i] = ox + waveX + oceanFlow * 0.3;
    positions[i + 1] = oy * amplify + beatLift + waveY + oceanFlow;
    positions[i + 2] = oz + waveZ + oceanFlow * 0.3;
  }
}
